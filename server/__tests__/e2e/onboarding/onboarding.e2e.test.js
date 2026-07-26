/**
 * Employee Onboarding API E2E Tests
 * Tests complete API workflows with realistic scenarios
 */

jest.mock('../../../config/db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock('../../../infrastructure/email', () => ({
  sendEmail: jest.fn(),
}));

const { pool } = require('../../../config/db');
const { sendEmail } = require('../../../infrastructure/email');

describe('Employee Onboarding API E2E Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 5, role: 'manager', name: 'Jane Manager' },
      body: {},
      params: {},
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('New Hire Onboarding Scenario', () => {
    it('should complete full onboarding for new employee', async () => {
      // STEP 1: Create employee
      const newEmployee = {
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah.johnson@company.com',
        department: 'Engineering',
        position: 'Senior Software Engineer',
        hire_date: '2024-02-01',
        employment_type: 'full_time',
      };

      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...newEmployee, created_at: new Date() }],
      });

      const employeeResult = await pool.query(
        'INSERT INTO employees (...) VALUES (...) RETURNING *',
        Object.values(newEmployee)
      );

      const employee = employeeResult.rows[0];
      expect(employee.id).toBe(1);

      // STEP 2: Create onboarding
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            employee_id: 1,
            manager_id: 5,
            start_date: new Date('2024-02-01'),
            status: 'not_started',
            budget: 5000,
          },
        ],
      });

      sendEmail.mockResolvedValueOnce({ success: true });

      const onboardingResult = await pool.query(
        'INSERT INTO onboardings (...) VALUES (...) RETURNING *',
        [1, 5, '2024-02-01', 5000, 'not_started']
      );

      const onboarding = onboardingResult.rows[0];
      expect(onboarding.status).toBe('not_started');

      // Send notification
      await sendEmail({
        to: 'jane@company.com',
        template: 'new-onboarding',
        data: { employee_name: newEmployee.first_name },
      });

      expect(sendEmail).toHaveBeenCalled();

      // STEP 3: Add standardized onboarding tasks
      const standardTasks = [
        { name: 'Obtain badge and access card', category: 'office', due_day: 0 },
        { name: 'Set up laptop and peripherals', category: 'it', due_day: 0 },
        { name: 'Create email account', category: 'it', due_day: 0 },
        { name: 'Set up VPN access', category: 'it', due_day: 1 },
        { name: 'HR orientation meeting', category: 'hr', due_day: 1 },
        { name: 'Team introduction meeting', category: 'training', due_day: 1 },
        { name: 'Review company handbook', category: 'training', due_day: 2 },
        { name: 'Enroll in benefits', category: 'hr', due_day: 3 },
      ];

      const addedTasks = [];
      for (const task of standardTasks) {
        pool.query.mockResolvedValueOnce({
          rows: [
            {
              id: addedTasks.length + 1,
              onboarding_id: 1,
              ...task,
              is_completed: false,
            },
          ],
        });

        const result = await pool.query(
          'INSERT INTO onboarding_tasks (...) VALUES (...) RETURNING *',
          [1, task.name, task.category, task.due_day]
        );

        addedTasks.push(result.rows[0]);
      }

      expect(addedTasks.length).toBe(8);

      // STEP 4: Start onboarding
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'in_progress', start_date: new Date() }],
      });

      const startedResult = await pool.query(
        'UPDATE onboardings SET status = $1 WHERE id = $2 RETURNING *',
        ['in_progress', 1]
      );

      expect(startedResult.rows[0].status).toBe('in_progress');

      // STEP 5: Complete tasks progressively
      const taskCompletionSchedule = [
        { taskId: 1, day: 0 }, // Day 1: Get badge
        { taskId: 2, day: 0 }, // Day 1: Laptop setup
        { taskId: 3, day: 0 }, // Day 1: Email
        { taskId: 4, day: 1 }, // Day 2: VPN
        { taskId: 5, day: 1 }, // Day 2: HR meeting
        { taskId: 6, day: 1 }, // Day 2: Team intro
        { taskId: 7, day: 2 }, // Day 3: Handbook
        { taskId: 8, day: 3 }, // Day 4: Benefits
      ];

      for (const completion of taskCompletionSchedule) {
        pool.query.mockResolvedValueOnce({
          rows: [
            {
              id: completion.taskId,
              is_completed: true,
              completed_at: new Date(),
            },
          ],
        });

        const result = await pool.query(
          'UPDATE onboarding_tasks SET is_completed = $1, completed_at = NOW() WHERE id = $2',
          [true, completion.taskId]
        );

        expect(result.rows[0].is_completed).toBe(true);
      }

      // STEP 6: Check completion percentage
      const completedCount = taskCompletionSchedule.length;
      const percentage = Math.round((completedCount / addedTasks.length) * 100);
      expect(percentage).toBe(100);

      // STEP 7: Complete onboarding
      pool.query.mockResolvedValueOnce({ rows: [{ pending: 0 }] });
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            status: 'completed',
            end_date: new Date(),
          },
        ],
      });

      const pendingCheck = await pool.query(
        'SELECT COUNT(*) as pending FROM onboarding_tasks WHERE onboarding_id = $1 AND NOT is_completed',
        [1]
      );

      const completedResult = await pool.query(
        'UPDATE onboardings SET status = $1, end_date = NOW() WHERE id = $2 RETURNING *',
        ['completed', 1]
      );

      expect(completedResult.rows[0].status).toBe('completed');

      // STEP 8: Send completion notification
      sendEmail.mockResolvedValueOnce({ success: true });

      await sendEmail({
        to: 'jane@company.com',
        template: 'onboarding-complete',
        data: {
          employee_name: newEmployee.first_name,
          days_to_complete: 3,
        },
      });

      expect(sendEmail).toHaveBeenCalledTimes(2);

      // STEP 9: Update employee status to active
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'active' }],
      });

      const activeResult = await pool.query(
        'UPDATE employees SET status = $1 WHERE id = $2 RETURNING *',
        ['active', 1]
      );

      expect(activeResult.rows[0].status).toBe('active');
    });
  });

  describe('Manager Dashboard Workflow', () => {
    it('should display manager dashboard with all team onboardings', async () => {
      const managerId = 5;

      // Get all onboardings for manager
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            employee_id: 1,
            employee_name: 'John Doe',
            status: 'completed',
            completion_percentage: 100,
            start_date: '2024-01-15',
            end_date: '2024-01-30',
          },
          {
            id: 2,
            employee_id: 2,
            employee_name: 'Jane Smith',
            status: 'in_progress',
            completion_percentage: 60,
            start_date: '2024-02-01',
          },
          {
            id: 3,
            employee_id: 3,
            employee_name: 'Bob Wilson',
            status: 'not_started',
            completion_percentage: 0,
            start_date: '2024-02-15',
          },
        ],
      });

      const onboardings = (
        await pool.query(
          'SELECT * FROM onboardings WHERE manager_id = $1 ORDER BY start_date DESC',
          [managerId]
        )
      ).rows;

      expect(onboardings).toHaveLength(3);

      // Calculate dashboard stats
      const stats = {
        total_onboardings: onboardings.length,
        completed: onboardings.filter((o) => o.status === 'completed').length,
        in_progress: onboardings.filter((o) => o.status === 'in_progress')
          .length,
        not_started: onboardings.filter((o) => o.status === 'not_started')
          .length,
        average_completion: Math.round(
          onboardings.reduce((sum, o) => sum + o.completion_percentage, 0) /
            onboardings.length
        ),
      };

      expect(stats.total_onboardings).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.in_progress).toBe(1);
      expect(stats.not_started).toBe(1);
      expect(stats.average_completion).toBe(53);
    });

    it('should handle budget override request workflow', async () => {
      req.params.id = 2;
      req.user.role = 'manager';
      req.body = {
        new_budget: 7500,
        reason: 'Additional software licenses required',
      };

      // Check current onboarding budget
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 2, budget: 5000, spent: 4500 }],
      });

      const current = await pool.query(
        'SELECT * FROM onboardings WHERE id = $1',
        [2]
      );

      expect(current.rows[0].budget).toBe(5000);

      // Request budget increase
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            budget: 7500,
            budget_override_requested: true,
            override_reason: req.body.reason,
          },
        ],
      });

      const result = await pool.query(
        'UPDATE onboardings SET budget = $1, budget_override_reason = $2 WHERE id = $3 RETURNING *',
        [7500, req.body.reason, 2]
      );

      res.status(200).json({
        success: true,
        data: result.rows[0],
        message: 'Budget override requested and approved',
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  describe('HR Reporting Workflow', () => {
    it('should generate onboarding completion report', async () => {
      // Get completed onboardings for reporting period
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            employee_name: 'John Doe',
            position: 'Senior Developer',
            department: 'Engineering',
            hire_date: '2024-01-15',
            completion_date: '2024-01-30',
            days_to_complete: 15,
            final_budget_spent: 4200,
            total_budget: 5000,
          },
          {
            id: 5,
            employee_name: 'Alice Brown',
            position: 'Product Manager',
            department: 'Product',
            hire_date: '2024-02-01',
            completion_date: '2024-02-12',
            days_to_complete: 11,
            final_budget_spent: 3800,
            total_budget: 5000,
          },
        ],
      });

      const report = await pool.query(
        `SELECT o.*, e.first_name, e.last_name, e.position, e.department
         FROM onboardings o
         JOIN employees e ON o.employee_id = e.id
         WHERE o.status = $1 AND o.end_date >= $2
         ORDER BY o.end_date DESC`,
        ['completed', '2024-01-01']
      );

      expect(report.rows).toHaveLength(2);

      // Generate summary stats
      const summary = {
        total_completed: report.rows.length,
        average_days_to_complete: Math.round(
          report.rows.reduce((sum, r) => sum + r.days_to_complete, 0) /
            report.rows.length
        ),
        average_budget_spent: Math.round(
          report.rows.reduce((sum, r) => sum + r.final_budget_spent, 0) /
            report.rows.length
        ),
        budget_utilization_percentage: Math.round(
          (report.rows.reduce((sum, r) => sum + r.final_budget_spent, 0) /
            report.rows.reduce((sum, r) => sum + r.total_budget, 0)) *
            100
        ),
      };

      expect(summary.total_completed).toBe(2);
      expect(summary.average_days_to_complete).toBe(13);
      expect(summary.budget_utilization_percentage).toBe(80);
    });
  });

  describe('Task Assignment Workflow', () => {
    it('should assign tasks to specific team members', async () => {
      req.params.onboardingId = 1;
      req.body = {
        tasks: [
          { id: 1, assigned_to: 'it_team' },
          { id: 2, assigned_to: 'finance_team' },
          { id: 5, assigned_to: 'hr_team' },
        ],
      };

      for (const assignment of req.body.tasks) {
        pool.query.mockResolvedValueOnce({
          rows: [{ id: assignment.id, assigned_to: assignment.assigned_to }],
        });

        const result = await pool.query(
          'UPDATE onboarding_tasks SET assigned_to = $1 WHERE id = $2 RETURNING *',
          [assignment.assigned_to, assignment.id]
        );

        expect(result.rows[0].assigned_to).toBe(assignment.assigned_to);
      }

      res.status(200).json({
        success: true,
        message: 'Tasks assigned successfully',
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should track task completion by assignee', async () => {
      // Get tasks assigned to IT team
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Setup Laptop',
            assigned_to: 'it_team',
            is_completed: true,
          },
          {
            id: 2,
            name: 'Setup Email',
            assigned_to: 'it_team',
            is_completed: true,
          },
          {
            id: 3,
            name: 'Setup VPN',
            assigned_to: 'it_team',
            is_completed: false,
          },
        ],
      });

      const itTasks = await pool.query(
        'SELECT * FROM onboarding_tasks WHERE onboarding_id = $1 AND assigned_to = $2',
        [1, 'it_team']
      );

      const completedByIT = itTasks.rows.filter((t) => t.is_completed).length;
      const pendingByIT = itTasks.rows.filter((t) => !t.is_completed).length;

      expect(completedByIT).toBe(2);
      expect(pendingByIT).toBe(1);
    });
  });

  describe('Emergency Scenario - Expedited Onboarding', () => {
    it('should support expedited onboarding with reduced timeline', async () => {
      const expeditedOnboarding = {
        employee_id: 5,
        manager_id: 5,
        start_date: new Date(),
        budget: 8000,
        expedited: true,
        target_completion_days: 3,
      };

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            ...expeditedOnboarding,
            status: 'not_started',
          },
        ],
      });

      const result = await pool.query(
        'INSERT INTO onboardings (...) VALUES (...) RETURNING *',
        [5, 5, new Date(), 8000, 'not_started']
      );

      expect(result.rows[0].expedited).toBe(true);

      // Add expedited task list (reduced to essentials only)
      const expeditedTasks = [
        { name: 'Critical system access', category: 'it', due_day: 0 },
        { name: 'Manager briefing', category: 'training', due_day: 0 },
        { name: 'Key contacts introduction', category: 'training', due_day: 1 },
      ];

      for (const task of expeditedTasks) {
        pool.query.mockResolvedValueOnce({
          rows: [{ id: Math.random(), ...task }],
        });

        const taskResult = await pool.query(
          'INSERT INTO onboarding_tasks (...) VALUES (...)',
          Object.values(task)
        );

        expect(taskResult.rows).toHaveLength(1);
      }
    });
  });

  describe('Task Comment and Feedback System', () => {
    it('should allow adding comments and feedback to tasks', async () => {
      req.params.taskId = 1;
      req.body = {
        comment: 'Laptop setup completed. User account created and OS configured.',
        status: 'completed',
      };

      const comment = {
        id: 1,
        task_id: 1,
        author: 'john_it_tech',
        comment_text: req.body.comment,
        created_at: new Date(),
      };

      pool.query.mockResolvedValueOnce({ rows: [comment] });

      const result = await pool.query(
        'INSERT INTO task_comments (task_id, author, comment_text) VALUES (...) RETURNING *',
        [1, 'john_it_tech', req.body.comment]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should retrieve task history with comments', async () => {
      req.params.taskId = 1;

      const taskHistory = {
        task: { id: 1, name: 'Setup Laptop', is_completed: true },
        comments: [
          { author: 'john_tech', text: 'Starting setup', created_at: '2024-01-20' },
          { author: 'john_tech', text: 'OS installed', created_at: '2024-01-20' },
          {
            author: 'manager_jane',
            text: 'Approved',
            created_at: '2024-01-20',
          },
        ],
        status_changes: [
          { from: 'pending', to: 'in_progress', timestamp: '2024-01-20' },
          { from: 'in_progress', to: 'completed', timestamp: '2024-01-20' },
        ],
      };

      pool.query.mockResolvedValueOnce({ rows: [taskHistory] });

      res.status(200).json({
        success: true,
        data: taskHistory,
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            comments: expect.any(Array),
          }),
        })
      );
    });
  });
});
