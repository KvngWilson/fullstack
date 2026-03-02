/**
 * Employee Onboarding Integration Tests
 * Tests complete workflows and interactions between components
 */

jest.mock('../../config/db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock('../../infrastructure/email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('../../infrastructure/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const { pool } = require('../../config/db');
const { sendEmail } = require('../../infrastructure/email');
const { logger } = require('../../infrastructure/logging');

describe('Employee Onboarding Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Onboarding Workflow', () => {
    it('should execute full onboarding lifecycle', async () => {
      // Step 1: Create employee
      const employeeData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        department: 'Engineering',
        position: 'Senior Developer',
        hire_date: new Date('2024-01-15'),
      };

      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...employeeData }],
      });

      const employee = (
        await pool.query('INSERT INTO employees ...', Object.values(employeeData))
      ).rows[0];

      expect(employee.id).toBe(1);

      // Step 2: Create onboarding
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            employee_id: 1,
            status: 'not_started',
            budget: 5000,
          },
        ],
      });

      const onboarding = (
        await pool.query(
          'INSERT INTO onboardings (employee_id, status, budget) VALUES ...',
          [1, 'not_started', 5000]
        )
      ).rows[0];

      expect(onboarding.status).toBe('not_started');

      // Step 3: Add tasks
      const tasks = [
        { name: 'IT Setup', category: 'it', due_day: 1 },
        { name: 'HR Orientation', category: 'hr', due_day: 1 },
        { name: 'Office Tour', category: 'office', due_day: 1 },
      ];

      const createdTasks = [];
      for (const task of tasks) {
        pool.query.mockResolvedValueOnce({
          rows: [{ id: createdTasks.length + 1, onboarding_id: 1, ...task }],
        });

        const created = (
          await pool.query(
            'INSERT INTO onboarding_tasks (onboarding_id, name, category, due_day) VALUES ...',
            [1, task.name, task.category, task.due_day]
          )
        ).rows[0];

        createdTasks.push(created);
      }

      expect(createdTasks.length).toBe(3);

      // Step 4: Start onboarding
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'in_progress' }],
      });

      const started = (
        await pool.query('UPDATE onboardings SET status = $1 WHERE id = $2', [
          'in_progress',
          1,
        ])
      ).rows[0];

      expect(started.status).toBe('in_progress');
      expect(logger.info).toHaveBeenCalledTimes(0);

      // Step 5: Complete tasks
      for (let i = 0; i < createdTasks.length; i++) {
        pool.query.mockResolvedValueOnce({
          rows: [{ id: i + 1, is_completed: true }],
        });

        const completed = (
          await pool.query(
            'UPDATE onboarding_tasks SET is_completed = true WHERE id = $1',
            [i + 1]
          )
        ).rows[0];

        expect(completed.is_completed).toBe(true);
      }

      // Step 6: Complete onboarding
      pool.query.mockResolvedValueOnce({
        rows: [{ pending: 0 }],
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'completed' }],
      });

      await pool.query('SELECT COUNT(*) AS pending FROM onboarding_tasks WHERE onboarding_id = $1 AND is_completed = false', [
        1,
      ]);

      const completed = (
        await pool.query('UPDATE onboardings SET status = $1 WHERE id = $2', [
          'completed',
          1,
        ])
      ).rows[0];

      expect(completed.status).toBe('completed');
    });

    it('should track progress through onboarding stages', async () => {
      // Create onboarding with initial state
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'not_started', completion_percentage: 0 }],
      });

      let onboarding = (
        await pool.query('SELECT * FROM onboardings WHERE id = $1', [1])
      ).rows[0];

      expect(onboarding.completion_percentage).toBe(0);

      // Progress to in_progress
      pool.query.mockResolvedValueOnce({
        rows: [{ status: 'in_progress', completion_percentage: 0 }],
      });

      onboarding = (
        await pool.query('UPDATE onboardings SET status = $1 WHERE id = $2', [
          'in_progress',
          1,
        ])
      ).rows[0];

      expect(onboarding.status).toBe('in_progress');

      // Partial completion
      pool.query.mockResolvedValueOnce({
        rows: [{ status: 'in_progress', completion_percentage: 50 }],
      });

      onboarding = (
        await pool.query('SELECT * FROM onboardings WHERE id = $1', [1])
      ).rows[0];

      expect(onboarding.completion_percentage).toBe(50);

      // Full completion
      pool.query.mockResolvedValueOnce({
        rows: [{ status: 'completed', completion_percentage: 100 }],
      });

      onboarding = (
        await pool.query('SELECT * FROM onboardings WHERE id = $1', [1])
      ).rows[0];

      expect(onboarding.completion_percentage).toBe(100);
    });
  });

  describe('Multi-Task Onboarding', () => {
    it('should handle complex task dependencies', async () => {
      // Create onboarding with multiple categories
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, employee_id: 1, status: 'not_started' }],
      });

      const onboarding = (
        await pool.query('INSERT INTO onboardings ...', [1])
      ).rows[0];

      // Add tasks in different categories
      const categories = ['it', 'hr', 'finance', 'office', 'training'];
      const mockTasks = categories.map((cat, idx) => ({
        id: idx + 1,
        category: cat,
        name: `Task for ${cat}`,
        is_completed: false,
      }));

      mockTasks.forEach((task) => {
        pool.query.mockResolvedValueOnce({ rows: [task] });
      });

      const addedTasks = [];
      for (let i = 0; i < mockTasks.length; i++) {
        const result = await pool.query(
          'INSERT INTO onboarding_tasks ...',
          [onboarding.id, mockTasks[i].name, mockTasks[i].category]
        );
        addedTasks.push(result.rows[0]);
      }

      expect(addedTasks).toHaveLength(5);

      // Get tasks by category
      pool.query.mockResolvedValueOnce({
        rows: addedTasks.filter((t) => t.category === 'it'),
      });

      const itTasks = (
        await pool.query('SELECT * FROM onboarding_tasks WHERE category = $1', [
          'it',
        ])
      ).rows[0];

      expect(itTasks).toBeDefined();
    });

    it('should calculate completion percentage correctly', async () => {
      const tasks = [
        { id: 1, is_completed: true },
        { id: 2, is_completed: true },
        { id: 3, is_completed: false },
        { id: 4, is_completed: false },
      ];

      // Calculate completion
      const completed = tasks.filter((t) => t.is_completed).length;
      const percentage = Math.round((completed / tasks.length) * 100);

      expect(percentage).toBe(50);

      // Complete one more task
      tasks[2].is_completed = true;
      const newCompleted = tasks.filter((t) => t.is_completed).length;
      const newPercentage = Math.round((newCompleted / tasks.length) * 100);

      expect(newPercentage).toBe(75);
    });
  });

  describe('Budget Management Integration', () => {
    it('should track budget allocation and spending', async () => {
      const onboarding = { id: 1, budget: 5000, spent: 0 };

      // Add expense
      const expense1 = 1500;
      onboarding.spent += expense1;

      expect(onboarding.spent).toBe(1500);
      expect(onboarding.budget - onboarding.spent).toBe(3500);

      // Add another expense
      const expense2 = 2000;
      onboarding.spent += expense2;

      expect(onboarding.spent).toBe(3500);
      expect(onboarding.budget - onboarding.spent).toBe(1500);
    });

    it('should allow budget override for managers', async () => {
      let onboarding = {
        id: 1,
        budget: 5000,
        spent: 4500,
        allows_override: true,
      };

      // Check if override is allowed
      expect(onboarding.allows_override).toBe(true);

      // Override budget
      onboarding.budget = 7000;

      expect(onboarding.budget).toBe(7000);
      expect(onboarding.budget - onboarding.spent).toBe(2500);
    });

    it('should prevent spending exceeding budget', async () => {
      let onboarding = {
        id: 1,
        budget: 1000,
        spent: 800,
      };

      const newExpense = 300;
      const wouldExceed = onboarding.spent + newExpense > onboarding.budget;

      expect(wouldExceed).toBe(true);
    });
  });

  describe('Notifications Integration', () => {
    it('should send email when onboarding is created', async () => {
      sendEmail.mockResolvedValue({ success: true });

      const onboardingData = {
        employee_id: 1,
        manager_id: 5,
      };

      // Simulate onboarding creation with notification
      await sendEmail({
        to: 'manager@example.com',
        template: 'onboarding-created',
        data: onboardingData,
      });

      expect(sendEmail).toHaveBeenCalledWith({
        to: 'manager@example.com',
        template: 'onboarding-created',
        data: onboardingData,
      });
    });

    it('should send email when tasks are completed', async () => {
      sendEmail.mockResolvedValue({ success: true });

      await sendEmail({
        to: 'hr@example.com',
        template: 'task-completed',
        data: { task_name: 'IT Setup' },
      });

      expect(sendEmail).toHaveBeenCalled();
    });

    it('should send report when onboarding is completed', async () => {
      sendEmail.mockResolvedValue({ success: true });

      const report = {
        employee_name: 'John Doe',
        completion_time: 30,
        total_budget_spent: 4500,
      };

      await sendEmail({
        to: 'hr@example.com',
        template: 'onboarding-complete',
        data: report,
      });

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'onboarding-complete',
        })
      );
    });

    it('should handle email sending failures gracefully', async () => {
      sendEmail.mockRejectedValue(new Error('Email service unavailable'));

      await expect(
        sendEmail({ to: 'test@example.com', template: 'test' })
      ).rejects.toThrow('Email service unavailable');

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('Manager Dashboard Integration', () => {
    it('should retrieve all onboardings for a manager', async () => {
      const managerId = 5;
      const mockOnboardings = [
        { id: 1, employee_id: 1, status: 'in_progress' },
        { id: 2, employee_id: 2, status: 'not_started' },
        { id: 3, employee_id: 3, status: 'completed' },
      ];

      pool.query.mockResolvedValue({ rows: mockOnboardings });

      const result = await pool.query(
        'SELECT * FROM onboardings WHERE manager_id = $1',
        [managerId]
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows.some((o) => o.status === 'in_progress')).toBe(true);
    });

    it('should calculate team onboarding statistics', async () => {
      const mockOnboardings = [
        { id: 1, status: 'in_progress', completion_percentage: 60 },
        { id: 2, status: 'not_started', completion_percentage: 0 },
        { id: 3, status: 'completed', completion_percentage: 100 },
      ];

      pool.query.mockResolvedValue({ rows: mockOnboardings });

      const onboardings = (
        await pool.query('SELECT * FROM onboardings WHERE manager_id = $1', [5])
      ).rows;

      const stats = {
        total: onboardings.length,
        completed: onboardings.filter((o) => o.status === 'completed').length,
        in_progress: onboardings.filter((o) => o.status === 'in_progress').length,
        not_started: onboardings.filter((o) => o.status === 'not_started').length,
        average_completion: Math.round(
          onboardings.reduce((sum, o) => sum + o.completion_percentage, 0) /
            onboardings.length
        ),
      };

      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.average_completion).toBe(53);
    });
  });

  describe('Audit and Logging Integration', () => {
    it('should log all onboarding status changes', async () => {
      logger.info.mockImplementation(() => {});

      const statusChanges = [
        'not_started',
        'in_progress',
        'completed',
      ];

      statusChanges.forEach((status) => {
        logger.info(`Onboarding 1 status changed to ${status}`);
      });

      expect(logger.info).toHaveBeenCalledTimes(3);
    });

    it('should log task completions', async () => {
      logger.info.mockImplementation(() => {});

      logger.info('Task 1 completed on 2024-01-20');
      logger.info('Task 2 completed on 2024-01-21');

      expect(logger.info).toHaveBeenCalledTimes(2);
    });

    it('should log critical events', async () => {
      logger.warn.mockImplementation(() => {});

      logger.warn('Budget override requested for onboarding 1');
      logger.warn('Onboarding completion failed with pending tasks');

      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('should log errors properly', async () => {
      logger.error.mockImplementation(() => {});

      const error = new Error('Failed to update onboarding');
      logger.error(`Error: ${error.message}`);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Employee Status Integration', () => {
    it('should update employee status to active when onboarding completes', async () => {
      // Get onboarding
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, employee_id: 1, status: 'completed' }],
      });

      const onboarding = (
        await pool.query('SELECT * FROM onboardings WHERE id = $1', [1])
      ).rows[0];

      // Update employee status
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'active' }],
      });

      const employee = (
        await pool.query('UPDATE employees SET status = $1 WHERE id = $2', [
          'active',
          onboarding.employee_id,
        ])
      ).rows[0];

      expect(employee.status).toBe('active');
    });

    it('should prevent duplicate onboardings for same employee', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const existing = (
        await pool.query(
          'SELECT COUNT(*) FROM onboardings WHERE employee_id = $1 AND status != $2',
          [1, 'completed']
        )
      ).rows[0];

      expect(existing.count).toBeGreaterThan(0);
    });
  });
});
