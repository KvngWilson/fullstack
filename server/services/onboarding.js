const { pool } = require("../config/db");
const { logger } = require("../shared/utils/logger");
const {
  ValidationError,
  NotFoundError,
  AuthorizationError,
} = require("../shared/utils/errors");

const VALID_CATEGORIES = ["it", "hr", "finance", "office", "training", "general"];
const VALID_STATUSES = ["not_started", "in_progress", "completed", "cancelled"];
const DEFAULT_BUDGET = 5000;
const BUDGET_OVERRIDE_MIN = 3000;

// ─── Private helpers ──────────────────────────────────────────────────────────

async function fetchOnboarding(id, executor = pool) {
  const result = await executor.query(
    `SELECT o.*,
            e.user_id AS employee_user_id,
            m.user_id AS manager_user_id
     FROM onboardings o
     JOIN employees e ON o.employee_id = e.id
     LEFT JOIN employees m ON o.manager_id = m.id
     WHERE o.id = $1`,
    [id],
  );
  if (result.rowCount === 0) throw new NotFoundError("Onboarding not found");
  return result.rows[0];
}

async function countPendingTasks(onboardingId, executor = pool) {
  const result = await executor.query(
    "SELECT COUNT(*) AS pending FROM onboarding_tasks WHERE onboarding_id = $1 AND is_completed = false",
    [onboardingId],
  );
  return parseInt(result.rows[0].pending, 10);
}

// ─── OnboardingService ────────────────────────────────────────────────────────

class OnboardingService {
  /**
   * Create a new onboarding plan for an employee.
   * @param {object} params
   * @param {number} params.employeeId
   * @param {string} params.startDate  - ISO date string or Date
   * @param {number} [params.managerId]
   * @param {number} [params.budget]
   * @param {string} [params.notes]
   * @returns {Promise<object>} Created onboarding row
   */
  static async createOnboarding({ employeeId, startDate, managerId, budget, notes }) {
    if (!employeeId) throw new ValidationError("Employee ID is required");
    if (!startDate)  throw new ValidationError("Start date is required");

    const resolvedBudget = budget ?? DEFAULT_BUDGET;
    if (resolvedBudget < 0) throw new ValidationError("Budget cannot be negative");

    // Verify employee exists
    const empCheck = await pool.query(
      "SELECT id FROM employees WHERE id = $1",
      [employeeId],
    );
    if (empCheck.rowCount === 0) throw new NotFoundError("Employee not found");

    const result = await pool.query(
      `INSERT INTO onboardings (employee_id, manager_id, start_date, budget, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [employeeId, managerId ?? null, startDate, resolvedBudget, notes ?? null],
    );

    logger.info("Onboarding created", { onboardingId: result.rows[0].id, employeeId });
    return result.rows[0];
  }

  /**
   * Get a single onboarding with its task list.
   * @param {number} id
   * @returns {Promise<object>}
   */
  static async getOnboarding(id) {
    const onboarding = await fetchOnboarding(id);

    const tasks = await pool.query(
      `SELECT * FROM onboarding_tasks WHERE onboarding_id = $1 ORDER BY due_day ASC NULLS LAST, id ASC`,
      [id],
    );

    return { ...onboarding, tasks: tasks.rows };
  }

  /**
   * List onboardings with optional filtering and pagination.
   * @param {object} params
   * @param {string}  [params.status]
   * @param {number}  [params.managerId]
   * @param {number}  [params.page=1]
   * @param {number}  [params.pageSize=20]
   * @returns {Promise<{ rows: object[], total: number }>}
   */
  static async listOnboardings({ status, managerId, page = 1, pageSize = 20 } = {}) {
    if (status && !VALID_STATUSES.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (managerId) {
      params.push(managerId);
      conditions.push(`o.manager_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM onboardings o ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const offset = (Math.max(1, page) - 1) * pageSize;
    params.push(pageSize, offset);

    const rows = await pool.query(
      `SELECT o.*,
              u.first_name || ' ' || u.last_name AS employee_name,
              mu.first_name || ' ' || mu.last_name AS manager_name
       FROM onboardings o
       JOIN employees e ON o.employee_id = e.id
       JOIN users u ON e.user_id = u.id
       LEFT JOIN employees me ON o.manager_id = me.id
       LEFT JOIN users mu ON me.user_id = mu.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { rows: rows.rows, total };
  }

  /**
   * Get detailed status (completion percentage, task counts by category).
   * @param {number} id
   * @returns {Promise<object>}
   */
  static async getOnboardingStatus(id) {
    await fetchOnboarding(id); // ensures 404 if missing

    const result = await pool.query(
      `WITH filtered_tasks AS (
         SELECT is_completed, category
         FROM onboarding_tasks
         WHERE onboarding_id = $1
       ),
       category_counts AS (
         SELECT
           category,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE is_completed) AS completed
         FROM filtered_tasks
         GROUP BY category
       )
       SELECT
         COUNT(*)::int AS total_tasks,
         COUNT(*) FILTER (WHERE is_completed)::int AS completed_tasks,
         COUNT(*) FILTER (WHERE NOT is_completed)::int AS pending_tasks,
         (
           SELECT json_object_agg(
             category_counts.category,
             json_build_object(
               'total', category_counts.total,
               'completed', category_counts.completed
             )
           )
           FROM category_counts
         ) AS tasks_by_category
       FROM filtered_tasks`,
      [id],
    );

    const stats = result.rows[0];
    const total = parseInt(stats.total_tasks, 10);
    const completed = parseInt(stats.completed_tasks, 10);

    return {
      id,
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: parseInt(stats.pending_tasks, 10),
      completionPercentage: total === 0 ? 0 : Math.round((completed / total) * 100),
      tasksByCategory: stats.tasks_by_category || {},
    };
  }

  /**
   * Update budget or notes on an onboarding.
   * @param {number} id
   * @param {object} updates  - { budget?, notes? }
   * @returns {Promise<object>}
   */
  static async updateOnboarding(id, { budget, notes }) {
    const onboarding = await fetchOnboarding(id);

    if (onboarding.status === "completed" || onboarding.status === "cancelled") {
      throw new ValidationError("Cannot update a completed or cancelled onboarding");
    }

    if (budget !== undefined) {
      if (budget < 0) throw new ValidationError("Budget cannot be negative");
      if (budget < parseFloat(onboarding.budget_spent)) {
        throw new ValidationError(
          "Budget cannot be decreased below already spent amount",
        );
      }
    }

    const sets = [];
    const params = [];

    if (budget !== undefined) { params.push(budget);  sets.push(`budget = $${params.length}`); }
    if (notes  !== undefined) { params.push(notes);   sets.push(`notes  = $${params.length}`); }

    if (sets.length === 0) return onboarding;

    params.push(id);
    const result = await pool.query(
      `UPDATE onboardings SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );

    logger.info("Onboarding updated", { id, fields: sets });
    return result.rows[0];
  }

  /**
   * Transition onboarding from not_started → in_progress.
   * @param {number} id
   * @returns {Promise<object>}
   */
  static async startOnboarding(id) {
    const onboarding = await fetchOnboarding(id);

    if (onboarding.status !== "not_started") {
      throw new ValidationError(
        `Onboarding must be in not_started status to start (current: ${onboarding.status})`,
      );
    }

    const result = await pool.query(
      `UPDATE onboardings SET status = 'in_progress' WHERE id = $1 RETURNING *`,
      [id],
    );

    logger.info("Onboarding started", { id });
    return result.rows[0];
  }

  /**
   * Transition onboarding in_progress → completed.
   * All tasks must be complete first.
   * @param {number} id
   * @returns {Promise<object>}
   */
  static async completeOnboarding(id) {
    const onboarding = await fetchOnboarding(id);

    if (onboarding.status === "completed") {
      throw new ValidationError("Onboarding is already completed");
    }
    if (onboarding.status !== "in_progress") {
      throw new ValidationError("Onboarding must be in_progress to complete");
    }

    const pending = await countPendingTasks(id);
    if (pending > 0) {
      throw new ValidationError(`Cannot complete with ${pending} pending tasks`);
    }

    const result = await pool.query(
      `UPDATE onboardings SET status = 'completed', end_date = CURRENT_DATE WHERE id = $1 RETURNING *`,
      [id],
    );

    logger.info("Onboarding completed", { id });
    return result.rows[0];
  }

  // ─── Task management ────────────────────────────────────────────────────────

  /**
   * Add a task to an onboarding.
   * @param {number} onboardingId
   * @param {object} task  - { name, category?, description?, dueDay?, assignedTo? }
   * @returns {Promise<object>}
   */
  static async addTask(onboardingId, { name, category = "general", description, dueDay, assignedTo }) {
    await fetchOnboarding(onboardingId); // 404 guard

    if (!name || !name.trim()) throw new ValidationError("Task name is required");

    if (!VALID_CATEGORIES.includes(category)) {
      throw new ValidationError(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`);
    }

    if (dueDay !== undefined && (dueDay < 0 || dueDay > 365)) {
      throw new ValidationError("Due day must be between 0 and 365");
    }

    const result = await pool.query(
      `INSERT INTO onboarding_tasks (onboarding_id, name, description, category, due_day, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [onboardingId, name.trim(), description ?? null, category, dueDay ?? null, assignedTo ?? null],
    );

    logger.info("Onboarding task added", { onboardingId, taskId: result.rows[0].id });
    return result.rows[0];
  }

  /**
   * Mark a task as completed.
   * @param {number} onboardingId
   * @param {number} taskId
   * @returns {Promise<object>}
   */
  static async completeTask(onboardingId, taskId) {
    const taskResult = await pool.query(
      "SELECT * FROM onboarding_tasks WHERE id = $1 AND onboarding_id = $2",
      [taskId, onboardingId],
    );

    if (taskResult.rowCount === 0) throw new NotFoundError("Task not found");

    const task = taskResult.rows[0];
    if (task.is_completed) throw new ValidationError("Task is already completed");

    const result = await pool.query(
      `UPDATE onboarding_tasks
       SET is_completed = true, completed_at = now()
       WHERE id = $1
       RETURNING *`,
      [taskId],
    );

    logger.info("Onboarding task completed", { onboardingId, taskId });
    return result.rows[0];
  }

  // ─── Budget override ────────────────────────────────────────────────────────

  /**
   * Apply an HR-authorised budget override.
   * Requires current budget > BUDGET_OVERRIDE_MIN (3000).
   * @param {number} id
   * @param {number} newBudget
   * @param {string} reason
   * @returns {Promise<object>}
   */
  static async applyBudgetOverride(id, newBudget, reason) {
    const onboarding = await fetchOnboarding(id);

    if (newBudget <= 0) throw new ValidationError("New budget must be positive");

    if (parseFloat(onboarding.budget) <= BUDGET_OVERRIDE_MIN) {
      throw new ValidationError(
        `Budget override not allowed: current budget must exceed ${BUDGET_OVERRIDE_MIN}`,
      );
    }

    const result = await pool.query(
      `UPDATE onboardings
       SET budget = $1, budget_overridden = true, budget_override_reason = $2
       WHERE id = $3
       RETURNING *`,
      [newBudget, reason ?? null, id],
    );

    logger.info("Onboarding budget overridden", { id, newBudget });
    return result.rows[0];
  }

  // ─── Error mapping ──────────────────────────────────────────────────────────

  static getErrorStatus(error) {
    if (error instanceof ValidationError)   return 400;
    if (error instanceof NotFoundError)     return 404;
    if (error instanceof AuthorizationError) return 403;
    return error.statusCode || error.status || 500;
  }
}

module.exports = OnboardingService;
