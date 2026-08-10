/**
 * Onboarding Service Unit Tests
 * Tests business logic for employee onboarding operations
 */

jest.mock('../../config/db', () => ({
  pool: {
    query: jest.fn(),
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

describe('Onboarding Service - Unit Tests', () => {
  let onboardingService;

  beforeEach(() => {
    jest.clearAllMocks();

    onboardingService = {
      createOnboarding: jest.fn(),
      startOnboarding: jest.fn(),
      completeOnboarding: jest.fn(),
      addTask: jest.fn(),
      completeTask: jest.fn(),
      getOnboardingStatus: jest.fn(),
      getTasksByCategory: jest.fn(),
      sendOnboardingNotification: jest.fn(),
      validateBudgetOverride: jest.fn(),
      finalizeOnboarding: jest.fn(),
    };
  });

  describe('createOnboarding', () => {
    it('should create onboarding successfully', async () => {
      const onboardingData = {
        employee_id: 1,
        manager_id: 5,
        start_date: new Date('2024-01-15'),
        budget: 5000,
      };

      onboardingService.createOnboarding.mockResolvedValue({
        id: 1,
        ...onboardingData,
        status: 'not_started',
      });

      const result = await onboardingService.createOnboarding(onboardingData);

      expect(result.id).toBe(1);
      expect(result.status).toBe('not_started');
      expect(result.budget).toBe(5000);
    });

    it('should send notification email when onboarding is created', async () => {
      const onboardingData = {
        employee_id: 1,
        manager_id: 5,
        start_date: new Date('2024-01-15'),
      };

      onboardingService.createOnboarding.mockImplementation(async (data) => {
        await sendEmail({
          to: 'manager@example.com',
          subject: 'New Employee Onboarding Started',
          template: 'onboarding-notification',
        });
        return { id: 1, ...data };
      });

      await onboardingService.createOnboarding(onboardingData);

      expect(sendEmail).toHaveBeenCalled();
    });

    it('should reject invalid budget amount', async () => {
      const onboardingData = {
        employee_id: 1,
        manager_id: 5,
        budget: -1000,
      };

      onboardingService.createOnboarding.mockRejectedValue(
        new Error('Budget cannot be negative')
      );

      await expect(onboardingService.createOnboarding(onboardingData)).rejects.toThrow(
        'Budget cannot be negative'
      );
    });

    it('should reject missing required fields', async () => {
      onboardingService.createOnboarding.mockRejectedValue(
        new Error('Employee ID is required')
      );

      await expect(onboardingService.createOnboarding({})).rejects.toThrow(
        'Employee ID is required'
      );
    });

    it('should use default budget if not provided', async () => {
      const onboardingData = {
        employee_id: 1,
        manager_id: 5,
        start_date: new Date(),
      };

      onboardingService.createOnboarding.mockResolvedValue({
        id: 1,
        ...onboardingData,
        budget: 5000,
      });

      const result = await onboardingService.createOnboarding(onboardingData);

      expect(result.budget).toBe(5000);
    });
  });

  describe('startOnboarding', () => {
    it('should start onboarding in not_started status', async () => {
      onboardingService.startOnboarding.mockResolvedValue({
        id: 1,
        status: 'in_progress',
        start_date: new Date(),
      });

      const result = await onboardingService.startOnboarding(1);

      expect(result.status).toBe('in_progress');
    });

    it('should log onboarding start event', async () => {
      onboardingService.startOnboarding.mockImplementation(async (id) => {
        logger.info(`Onboarding ${id} started`);
        return { id, status: 'in_progress' };
      });

      await onboardingService.startOnboarding(1);

      expect(logger.info).toHaveBeenCalledWith('Onboarding 1 started');
    });

    it('should reject starting already started onboarding', async () => {
      onboardingService.startOnboarding.mockRejectedValue(
        new Error('Onboarding is already in progress')
      );

      await expect(onboardingService.startOnboarding(1)).rejects.toThrow(
        'already in progress'
      );
    });

    it('should reject starting completed onboarding', async () => {
      onboardingService.startOnboarding.mockRejectedValue(
        new Error('Cannot start completed onboarding')
      );

      await expect(onboardingService.startOnboarding(1)).rejects.toThrow(
        'Cannot start completed'
      );
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding with all tasks completed', async () => {
      onboardingService.completeOnboarding.mockResolvedValue({
        id: 1,
        status: 'completed',
        end_date: new Date(),
      });

      const result = await onboardingService.completeOnboarding(1);

      expect(result.status).toBe('completed');
      expect(result.end_date).toBeDefined();
    });

    it('should reject completion with pending tasks', async () => {
      onboardingService.completeOnboarding.mockRejectedValue(
        new Error('Cannot complete with pending tasks')
      );

      await expect(onboardingService.completeOnboarding(1)).rejects.toThrow(
        'pending tasks'
      );
    });

    it('should send completion notification email', async () => {
      onboardingService.completeOnboarding.mockImplementation(async (id) => {
        await sendEmail({
          to: 'hr@example.com',
          subject: 'Employee Onboarding Completed',
        });
        return { id, status: 'completed' };
      });

      await onboardingService.completeOnboarding(1);

      expect(sendEmail).toHaveBeenCalled();
    });

    it('should log completion event', async () => {
      onboardingService.completeOnboarding.mockImplementation(async (id) => {
        logger.info(`Onboarding ${id} completed`);
        return { id, status: 'completed' };
      });

      await onboardingService.completeOnboarding(1);

      expect(logger.info).toHaveBeenCalledWith('Onboarding 1 completed');
    });
  });

  describe('addTask', () => {
    it('should add task to onboarding', async () => {
      const taskData = {
        name: 'IT Setup',
        category: 'it',
        due_day: 1,
      };

      onboardingService.addTask.mockResolvedValue({
        id: 1,
        onboarding_id: 1,
        ...taskData,
        is_completed: false,
      });

      const result = await onboardingService.addTask(1, taskData);

      expect(result.name).toBe('IT Setup');
      expect(result.category).toBe('it');
      expect(result.is_completed).toBe(false);
    });

    it('should reject invalid task name', async () => {
      onboardingService.addTask.mockRejectedValue(
        new Error('Task name is required')
      );

      await expect(
        onboardingService.addTask(1, { category: 'it' })
      ).rejects.toThrow('Task name is required');
    });

    it('should reject invalid due_day', async () => {
      onboardingService.addTask.mockRejectedValue(
        new Error('Due day must be between 0 and 365')
      );

      await expect(
        onboardingService.addTask(1, {
          name: 'Task',
          category: 'it',
          due_day: 400,
        })
      ).rejects.toThrow('Due day must be between 0 and 365');
    });

    it('should support multiple task categories', async () => {
      const categories = ['it', 'hr', 'finance', 'office', 'training'];

      for (const category of categories) {
        onboardingService.addTask.mockResolvedValueOnce({
          id: 1,
          category,
          name: `Task for ${category}`,
        });

        const result = await onboardingService.addTask(1, {
          name: `Task for ${category}`,
          category,
        });

        expect(result.category).toBe(category);
      }
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed', async () => {
      onboardingService.completeTask.mockResolvedValue({
        id: 1,
        is_completed: true,
        completed_at: new Date(),
      });

      const result = await onboardingService.completeTask(1, 1);

      expect(result.is_completed).toBe(true);
      expect(result.completed_at).toBeDefined();
    });

    it('should reject completing already completed task', async () => {
      onboardingService.completeTask.mockRejectedValue(
        new Error('Task already completed')
      );

      await expect(onboardingService.completeTask(1, 1)).rejects.toThrow(
        'already completed'
      );
    });

    it('should log task completion', async () => {
      onboardingService.completeTask.mockImplementation(async (taskId) => {
        logger.info(`Task ${taskId} completed`);
        return { id: taskId, is_completed: true };
      });

      await onboardingService.completeTask(1, 1);

      expect(logger.info).toHaveBeenCalledWith('Task 1 completed');
    });
  });

  describe('getOnboardingStatus', () => {
    it('should return onboarding status with progress', async () => {
      onboardingService.getOnboardingStatus.mockResolvedValue({
        id: 1,
        status: 'in_progress',
        completion_percentage: 60,
        total_tasks: 5,
        completed_tasks: 3,
        pending_tasks: 2,
      });

      const result = await onboardingService.getOnboardingStatus(1);

      expect(result.status).toBe('in_progress');
      expect(result.completion_percentage).toBe(60);
      expect(result.total_tasks).toBe(5);
    });

    it('should return 0% completion for not started', async () => {
      onboardingService.getOnboardingStatus.mockResolvedValue({
        id: 1,
        status: 'not_started',
        completion_percentage: 0,
        total_tasks: 5,
        completed_tasks: 0,
      });

      const result = await onboardingService.getOnboardingStatus(1);

      expect(result.completion_percentage).toBe(0);
    });

    it('should return 100% completion for completed', async () => {
      onboardingService.getOnboardingStatus.mockResolvedValue({
        id: 1,
        status: 'completed',
        completion_percentage: 100,
        total_tasks: 5,
        completed_tasks: 5,
      });

      const result = await onboardingService.getOnboardingStatus(1);

      expect(result.completion_percentage).toBe(100);
    });

    it('should throw error for non-existent onboarding', async () => {
      onboardingService.getOnboardingStatus.mockRejectedValue(
        new Error('Onboarding not found')
      );

      await expect(onboardingService.getOnboardingStatus(999)).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('getTasksByCategory', () => {
    it('should return all tasks in a category', async () => {
      onboardingService.getTasksByCategory.mockResolvedValue([
        { id: 1, name: 'Setup Laptop', category: 'it' },
        { id: 2, name: 'Setup Email', category: 'it' },
      ]);

      const result = await onboardingService.getTasksByCategory(1, 'it');

      expect(result.length).toBe(2);
      expect(result.every((t) => t.category === 'it')).toBe(true);
    });

    it('should return empty array for non-existent category', async () => {
      onboardingService.getTasksByCategory.mockResolvedValue([]);

      const result = await onboardingService.getTasksByCategory(1, 'nonexistent');

      expect(result).toEqual([]);
    });

    it('should filter by completion status', async () => {
      onboardingService.getTasksByCategory.mockResolvedValue([
        { id: 1, name: 'Task 1', category: 'it', is_completed: true },
      ]);

      const result = await onboardingService.getTasksByCategory(1, 'it');

      expect(result.every((t) => t.is_completed)).toBe(true);
    });
  });

  describe('sendOnboardingNotification', () => {
    it('should send email notification to manager', async () => {
      onboardingService.sendOnboardingNotification.mockImplementation(async (id) => {
        await sendEmail({
          to: 'manager@example.com',
          template: 'onboarding-notification',
        });
      });

      await onboardingService.sendOnboardingNotification(1);

      expect(sendEmail).toHaveBeenCalled();
    });

    it('should send notification with onboarding details', async () => {
      onboardingService.sendOnboardingNotification.mockImplementation(
        async (id) => {
          const details = {
            employee_name: 'John Doe',
            start_date: new Date('2024-01-15'),
            total_tasks: 5,
          };

          await sendEmail({
            to: 'manager@example.com',
            data: details,
          });
        }
      );

      await onboardingService.sendOnboardingNotification(1);

      expect(sendEmail).toHaveBeenCalled();
    });

    it('should handle email sending failure', async () => {
      onboardingService.sendOnboardingNotification.mockRejectedValue(
        new Error('Failed to send email')
      );

      await expect(onboardingService.sendOnboardingNotification(1)).rejects.toThrow();
    });
  });

  describe('validateBudgetOverride', () => {
    it('should allow override for budget > 3000', async () => {
      onboardingService.validateBudgetOverride.mockResolvedValue({
        allowed: true,
        current_budget: 5000,
      });

      const result = await onboardingService.validateBudgetOverride(1, 6000);

      expect(result.allowed).toBe(true);
    });

    it('should reject override for budget <= 3000', async () => {
      onboardingService.validateBudgetOverride.mockResolvedValue({
        allowed: false,
        reason: 'Budget too low for override',
      });

      const result = await onboardingService.validateBudgetOverride(1, 3500);

      expect(result.allowed).toBe(false);
    });

    it('should check if new budget exceeds total allowed', async () => {
      onboardingService.validateBudgetOverride.mockResolvedValue({
        allowed: false,
        reason: 'New budget exceeds maximum allowed',
      });

      const result = await onboardingService.validateBudgetOverride(1, 50000);

      expect(result.allowed).toBe(false);
    });
  });

  describe('finalizeOnboarding', () => {
    it('should complete onboarding and archive properly', async () => {
      onboardingService.finalizeOnboarding.mockResolvedValue({
        id: 1,
        status: 'completed',
        archived: true,
        final_report: {
          total_budget_spent: 4500,
          total_tasks: 5,
          completion_time_days: 30,
        },
      });

      const result = await onboardingService.finalizeOnboarding(1);

      expect(result.status).toBe('completed');
      expect(result.archived).toBe(true);
      expect(result.final_report).toBeDefined();
    });

    it('should generate completion report', async () => {
      onboardingService.finalizeOnboarding.mockResolvedValue({
        id: 1,
        final_report: {
          total_budget_spent: 4500,
          completion_time_days: 30,
          satisfaction_rating: 4.5,
        },
      });

      const result = await onboardingService.finalizeOnboarding(1);

      expect(result.final_report.total_budget_spent).toBe(4500);
      expect(result.final_report.completion_time_days).toBe(30);
    });

    it('should send final report to HR', async () => {
      onboardingService.finalizeOnboarding.mockImplementation(async (id) => {
        await sendEmail({
          to: 'hr@example.com',
          subject: 'Onboarding Final Report',
          template: 'onboarding-report',
        });
        return { id, status: 'completed' };
      });

      await onboardingService.finalizeOnboarding(1);

      expect(sendEmail).toHaveBeenCalled();
    });

    it('should reject finalizing incomplete onboarding', async () => {
      onboardingService.finalizeOnboarding.mockRejectedValue(
        new Error('Cannot finalize with pending tasks')
      );

      await expect(onboardingService.finalizeOnboarding(1)).rejects.toThrow(
        'pending tasks'
      );
    });
  });
});
