const { logger } = require("../../../../shared/utils/logger");
const OnboardingService = require("../../../../services/onboarding");
const {
  successResponse,
  errorResponse,
  paginatedResponse,
} = require("../../../../shared/utils/response");

// ─── Onboarding CRUD ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/onboarding
 */
exports.createOnboarding = async (req, res) => {
  try {
    const { employeeId, startDate, managerId, budget, notes } = req.body;

    const onboarding = await OnboardingService.createOnboarding({
      employeeId,
      startDate,
      managerId,
      budget,
      notes,
    });

    return successResponse(res, {
      data: onboarding,
      message: "Onboarding created successfully",
      status: 201,
    });
  } catch (error) {
    logger.error("createOnboarding failed", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: OnboardingService.getErrorStatus(error),
    });
  }
};

/**
 * GET /api/v1/onboarding
 */
exports.listOnboardings = async (req, res) => {
  try {
    const { status, managerId, page = 1, limit = 20 } = req.query;

    const { rows, total } = await OnboardingService.listOnboardings({
      status,
      managerId: managerId ? Number(managerId) : undefined,
      page: Number(page),
      pageSize: Number(limit),
    });

    return paginatedResponse(res, {
      data: rows,
      page: Number(page),
      pageSize: Number(limit),
      total,
    });
  } catch (error) {
    logger.error("listOnboardings failed", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: OnboardingService.getErrorStatus(error),
    });
  }
};

/**
 * GET /api/v1/onboarding/:id
 */
exports.getOnboarding = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return errorResponse(res, {
        message: "Invalid onboarding ID",
        status: 400,
      });
    }

    const onboarding = await OnboardingService.getOnboarding(id);
    return successResponse(res, { data: onboarding });
  } catch (error) {
    logger.error("getOnboarding failed", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: OnboardingService.getErrorStatus(error),
    });
  }
};

/**
 * GET /api/v1/onboarding/:id/status
 */
exports.getOnboardingStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return errorResponse(res, {
        message: "Invalid onboarding ID",
        status: 400,
      });
    }

    const status = await OnboardingService.getOnboardingStatus(id);
    return successResponse(res, { data: status });
  } catch (error) {
    logger.error("getOnboardingStatus failed", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: OnboardingService.getErrorStatus(error),
    });
  }
};

/**
 * PUT /api/v1/onboarding/:id
 */
exports.updateOnboarding = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return errorResponse(res, {
        message: "Invalid onboarding ID",
        status: 400,
      });
    }

    const { budget, notes } = req.body;
    const onboarding = await OnboardingService.updateOnboarding(id, {
      budget,
      notes,
    });
    return successResponse(res, {
      data: onboarding,
      message: "Onboarding updated",
    });
  } catch (error) {
    logger.error("updateOnboarding failed", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: OnboardingService.getErrorStatus(error),
    });
  }
};

// ─── Lifecycle transitions ────────────────────────────────────────────────────

/**
 * PUT /api/v1/onboarding/:id/start
 */
exports.startOnboarding = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return errorResponse(res, {
        message: "Invalid onboarding ID",
        status: 400,
      });
    }

    const onboarding = await OnboardingService.startOnboarding(id);
    return successResponse(res, {
      data: onboarding,
      message: "Onboarding started",
    });
  } catch (error) {
    logger.error("startOnboarding failed", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: OnboardingService.getErrorStatus(error),
    });
  }
};

/**
 * PUT /api/v1/onboarding/:id/complete
 */
exports.completeOnboarding = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return errorResponse(res, {
        message: "Invalid onboarding ID",
        status: 400,
      });
    }

    const onboarding = await OnboardingService.completeOnboarding(id);
    return successResponse(res, {
      data: onboarding,
      message: "Onboarding completed",
    });
  } catch (error) {
    logger.error("completeOnboarding failed", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: OnboardingService.getErrorStatus(error),
    });
  }
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/onboarding/:id/tasks
 */
exports.addTask = async (req, res) => {
  try {
    const onboardingId = Number(req.params.id);
    if (!Number.isInteger(onboardingId) || onboardingId < 1) {
      return errorResponse(res, {
        message: "Invalid onboarding ID",
        status: 400,
      });
    }

    const { name, category, description, dueDay, assignedTo } = req.body;

    const task = await OnboardingService.addTask(onboardingId, {
      name,
      category,
      description,
      dueDay,
      assignedTo,
    });

    return successResponse(res, {
      data: task,
      message: "Task added",
      status: 201,
    });
  } catch (error) {
    logger.error("addTask failed", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: OnboardingService.getErrorStatus(error),
    });
  }
};

/**
 * PUT /api/v1/onboarding/:id/tasks/:taskId/complete
 */
exports.completeTask = async (req, res) => {
  try {
    const onboardingId = Number(req.params.id);
    const taskId = Number(req.params.taskId);

    if (
      !Number.isInteger(onboardingId) ||
      onboardingId < 1 ||
      !Number.isInteger(taskId) ||
      taskId < 1
    ) {
      return errorResponse(res, { message: "Invalid ID", status: 400 });
    }

    const task = await OnboardingService.completeTask(onboardingId, taskId);
    return successResponse(res, { data: task, message: "Task completed" });
  } catch (error) {
    logger.error("completeTask failed", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: OnboardingService.getErrorStatus(error),
    });
  }
};

// ─── Budget override ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/onboarding/:id/budget-override
 */
exports.applyBudgetOverride = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return errorResponse(res, {
        message: "Invalid onboarding ID",
        status: 400,
      });
    }

    const { newBudget, reason } = req.body;

    if (newBudget === undefined || newBudget === null) {
      return errorResponse(res, {
        message: "New budget is required",
        status: 400,
      });
    }

    const onboarding = await OnboardingService.applyBudgetOverride(
      id,
      Number(newBudget),
      reason,
    );
    return successResponse(res, {
      data: onboarding,
      message: "Budget override applied",
    });
  } catch (error) {
    logger.error("applyBudgetOverride failed", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: OnboardingService.getErrorStatus(error),
    });
  }
};
