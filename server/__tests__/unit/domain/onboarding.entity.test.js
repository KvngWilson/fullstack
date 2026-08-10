/**
 * Onboarding Entity Unit Tests
 * Tests the Onboarding entity validation and workflow state management
 */

describe('Onboarding Entity', () => {
  class OnboardingTask {
    constructor(data = {}) {
      this.id = data.id;
      this.name = data.name;
      this.description = data.description;
      this.category = data.category === undefined ? 'general' : data.category;
      this.due_day = data.due_day;
      this.assigned_to = data.assigned_to;
      this.is_completed = data.is_completed || false;
      this.completed_at = data.completed_at;
    }

    validate() {
      if (!this.name || this.name.trim() === '') {
        throw new Error('Task name is required');
      }
      if (!this.category) {
        throw new Error('Task category is required');
      }
      if (this.due_day !== undefined && (this.due_day < 0 || this.due_day > 365)) {
        throw new Error('Due day must be between 0 and 365');
      }
      return true;
    }

    markComplete(completedAt = new Date()) {
      if (this.is_completed) {
        throw new Error('Task already completed');
      }
      this.is_completed = true;
      this.completed_at = completedAt;
    }

    getStatus() {
      return this.is_completed ? 'completed' : 'pending';
    }
  }

  class Onboarding {
    constructor(data = {}) {
      this.id = data.id;
      this.employee_id = data.employee_id;
      this.start_date = data.start_date;
      this.end_date = data.end_date;
      this.status = data.status || 'not_started';
      this.manager_id = data.manager_id;
      this.budget = data.budget || 5000;
      this.notes = data.notes;
      this.tasks = data.tasks || [];
      this.created_at = data.created_at;
      this.updated_at = data.updated_at;
    }

    validate() {
      if (!this.employee_id) {
        throw new Error('Employee ID is required');
      }
      if (!this.start_date) {
        throw new Error('Start date is required');
      }
      if (this.budget < 0) {
        throw new Error('Budget cannot be negative');
      }
      return true;
    }

    addTask(task) {
      task.validate();
      this.tasks.push(task);
    }

    getCompletionPercentage() {
      if (this.tasks.length === 0) return 0;
      const completedCount = this.tasks.filter((t) => t.is_completed).length;
      return Math.round((completedCount / this.tasks.length) * 100);
    }

    markAsStarted(startDate = new Date()) {
      if (this.status !== 'not_started') {
        throw new Error('Onboarding can only be started from not_started status');
      }
      this.status = 'in_progress';
      this.start_date = startDate;
    }

    markAsComplete() {
      if (this.status === 'completed') {
        throw new Error('Onboarding is already completed');
      }
      const incompleteTasks = this.tasks.filter((t) => !t.is_completed);
      if (incompleteTasks.length > 0) {
        throw new Error(`Cannot mark as complete with ${incompleteTasks.length} pending tasks`);
      }
      this.status = 'completed';
      this.end_date = new Date();
    }

    getTasksByCategory(category) {
      return this.tasks.filter((t) => t.category === category);
    }

    getAllowsOverride() {
      return this.budget > 3000;
    }
  }

  describe('OnboardingTask', () => {
    describe('constructor', () => {
      it('should create task with required fields', () => {
        const task = new OnboardingTask({
          id: 1,
          name: 'IT Setup',
          description: 'Setup laptop and accounts',
          category: 'it',
          due_day: 1,
        });

        expect(task.name).toBe('IT Setup');
        expect(task.description).toBe('Setup laptop and accounts');
        expect(task.category).toBe('it');
        expect(task.due_day).toBe(1);
      });

      it('should set default category to general', () => {
        const task = new OnboardingTask({
          name: 'Review handbook',
        });

        expect(task.category).toBe('general');
      });

      it('should set default is_completed to false', () => {
        const task = new OnboardingTask({
          name: 'Task',
        });

        expect(task.is_completed).toBe(false);
      });
    });

    describe('validate()', () => {
      it('should validate successful task', () => {
        const task = new OnboardingTask({
          name: 'IT Setup',
          category: 'it',
          due_day: 1,
        });

        expect(task.validate()).toBe(true);
      });

      it('should reject missing task name', () => {
        const task = new OnboardingTask({
          category: 'it',
        });

        expect(() => task.validate()).toThrow('Task name is required');
      });

      it('should reject empty task name', () => {
        const task = new OnboardingTask({
          name: '   ',
          category: 'it',
        });

        expect(() => task.validate()).toThrow('Task name is required');
      });

      it('should reject missing category', () => {
        const task = new OnboardingTask({
          name: 'Task',
          category: '',
        });

        expect(() => task.validate()).toThrow('Task category is required');
      });

      it('should reject due_day < 0', () => {
        const task = new OnboardingTask({
          name: 'Task',
          category: 'it',
          due_day: -1,
        });

        expect(() => task.validate()).toThrow('Due day must be between 0 and 365');
      });

      it('should reject due_day > 365', () => {
        const task = new OnboardingTask({
          name: 'Task',
          category: 'it',
          due_day: 366,
        });

        expect(() => task.validate()).toThrow('Due day must be between 0 and 365');
      });

      it('should accept valid due_day values', () => {
        [0, 1, 90, 180, 365].forEach((dueDay) => {
          const task = new OnboardingTask({
            name: 'Task',
            category: 'it',
            due_day: dueDay,
          });

          expect(task.validate()).toBe(true);
        });
      });
    });

    describe('markComplete()', () => {
      it('should mark task as complete', () => {
        const task = new OnboardingTask({
          name: 'Task',
          category: 'it',
        });

        task.markComplete();

        expect(task.is_completed).toBe(true);
        expect(task.completed_at).toBeDefined();
      });

      it('should reject marking already completed task', () => {
        const task = new OnboardingTask({
          name: 'Task',
          category: 'it',
          is_completed: true,
        });

        expect(() => task.markComplete()).toThrow('Task already completed');
      });

      it('should set completion time', () => {
        const task = new OnboardingTask({
          name: 'Task',
          category: 'it',
        });

        const completionTime = new Date('2024-02-15 10:30:00');
        task.markComplete(completionTime);

        expect(task.completed_at).toEqual(completionTime);
      });
    });

    describe('getStatus()', () => {
      it('should return pending for incomplete task', () => {
        const task = new OnboardingTask({
          name: 'Task',
          is_completed: false,
        });

        expect(task.getStatus()).toBe('pending');
      });

      it('should return completed for complete task', () => {
        const task = new OnboardingTask({
          name: 'Task',
          is_completed: true,
        });

        expect(task.getStatus()).toBe('completed');
      });
    });
  });

  describe('Onboarding', () => {
    describe('constructor', () => {
      it('should create onboarding with required fields', () => {
        const onboarding = new Onboarding({
          id: 1,
          employee_id: 1,
          start_date: new Date('2024-01-15'),
          manager_id: 5,
        });

        expect(onboarding.employee_id).toBe(1);
        expect(onboarding.start_date).toEqual(new Date('2024-01-15'));
        expect(onboarding.manager_id).toBe(5);
      });

      it('should set default status to not_started', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        expect(onboarding.status).toBe('not_started');
      });

      it('should set default budget to 5000', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        expect(onboarding.budget).toBe(5000);
      });

      it('should initialize empty tasks array', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        expect(Array.isArray(onboarding.tasks)).toBe(true);
        expect(onboarding.tasks.length).toBe(0);
      });

      it('should accept custom budget', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          budget: 10000,
        });

        expect(onboarding.budget).toBe(10000);
      });
    });

    describe('validate()', () => {
      it('should validate successful onboarding', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date('2024-01-15'),
        });

        expect(onboarding.validate()).toBe(true);
      });

      it('should reject missing employee_id', () => {
        const onboarding = new Onboarding({
          start_date: new Date('2024-01-15'),
        });

        expect(() => onboarding.validate()).toThrow('Employee ID is required');
      });

      it('should reject missing start_date', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
        });

        expect(() => onboarding.validate()).toThrow('Start date is required');
      });

      it('should reject negative budget', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          budget: -1000,
        });

        expect(() => onboarding.validate()).toThrow('Budget cannot be negative');
      });

      it('should accept zero budget', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          budget: 0,
        });

        expect(onboarding.validate()).toBe(true);
      });
    });

    describe('addTask()', () => {
      it('should add valid task to onboarding', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        const task = new OnboardingTask({
          name: 'IT Setup',
          category: 'it',
        });

        onboarding.addTask(task);

        expect(onboarding.tasks.length).toBe(1);
        expect(onboarding.tasks[0]).toEqual(task);
      });

      it('should reject invalid task', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        const invalidTask = new OnboardingTask({
          category: 'it',
        });

        expect(() => onboarding.addTask(invalidTask)).toThrow('Task name is required');
      });

      it('should add multiple tasks', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        const task1 = new OnboardingTask({
          name: 'IT Setup',
          category: 'it',
        });

        const task2 = new OnboardingTask({
          name: 'HR Orientation',
          category: 'hr',
        });

        onboarding.addTask(task1);
        onboarding.addTask(task2);

        expect(onboarding.tasks.length).toBe(2);
      });
    });

    describe('getCompletionPercentage()', () => {
      it('should return 0 when no tasks exist', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        expect(onboarding.getCompletionPercentage()).toBe(0);
      });

      it('should return 0 when no tasks are completed', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        const task1 = new OnboardingTask({ name: 'Task 1', category: 'it' });
        const task2 = new OnboardingTask({ name: 'Task 2', category: 'hr' });

        onboarding.addTask(task1);
        onboarding.addTask(task2);

        expect(onboarding.getCompletionPercentage()).toBe(0);
      });

      it('should return 50 when half tasks are completed', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        const task1 = new OnboardingTask({ name: 'Task 1', category: 'it', is_completed: true });
        const task2 = new OnboardingTask({ name: 'Task 2', category: 'hr' });

        onboarding.addTask(task1);
        onboarding.addTask(task2);

        expect(onboarding.getCompletionPercentage()).toBe(50);
      });

      it('should return 100 when all tasks are completed', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        const task1 = new OnboardingTask({ name: 'Task 1', category: 'it', is_completed: true });
        const task2 = new OnboardingTask({ name: 'Task 2', category: 'hr', is_completed: true });

        onboarding.addTask(task1);
        onboarding.addTask(task2);

        expect(onboarding.getCompletionPercentage()).toBe(100);
      });

      it('should round down completion percentage', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        const task1 = new OnboardingTask({
          name: 'Task 1',
          category: 'it',
          is_completed: true,
        });
        const task2 = new OnboardingTask({ name: 'Task 2', category: 'hr' });
        const task3 = new OnboardingTask({ name: 'Task 3', category: 'other' });

        onboarding.addTask(task1);
        onboarding.addTask(task2);
        onboarding.addTask(task3);

        expect(onboarding.getCompletionPercentage()).toBe(33);
      });
    });

    describe('markAsStarted()', () => {
      it('should mark onboarding as started', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date('2024-01-15'),
          status: 'not_started',
        });

        const startDate = new Date();
        onboarding.markAsStarted(startDate);

        expect(onboarding.status).toBe('in_progress');
        expect(onboarding.start_date).toEqual(startDate);
      });

      it('should use current date if no date provided', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date('2024-01-15'),
          status: 'not_started',
        });

        const beforeCall = new Date();
        onboarding.markAsStarted();
        const afterCall = new Date();

        expect(onboarding.status).toBe('in_progress');
        expect(onboarding.start_date.getTime()).toBeGreaterThanOrEqual(
          beforeCall.getTime()
        );
        expect(onboarding.start_date.getTime()).toBeLessThanOrEqual(afterCall.getTime());
      });

      it('should reject starting onboarding not in not_started status', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          status: 'in_progress',
        });

        expect(() => onboarding.markAsStarted()).toThrow(
          'Onboarding can only be started from not_started status'
        );
      });

      it('should reject completing already completed onboarding', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          status: 'completed',
        });

        expect(() => onboarding.markAsStarted()).toThrow();
      });
    });

    describe('markAsComplete()', () => {
      it('should mark onboarding as complete', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          status: 'in_progress',
        });

        const task = new OnboardingTask({
          name: 'Task 1',
          is_completed: true,
        });
        onboarding.addTask(task);

        onboarding.markAsComplete();

        expect(onboarding.status).toBe('completed');
        expect(onboarding.end_date).toBeDefined();
      });

      it('should reject marking complete with pending tasks', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          status: 'in_progress',
        });

        const task1 = new OnboardingTask({
          name: 'Task 1',
          is_completed: true,
        });
        const task2 = new OnboardingTask({
          name: 'Task 2',
          is_completed: false,
        });

        onboarding.addTask(task1);
        onboarding.addTask(task2);

        expect(() => onboarding.markAsComplete()).toThrow(
          'Cannot mark as complete with 1 pending tasks'
        );
      });

      it('should reject marking already completed onboarding', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          status: 'completed',
          end_date: new Date(),
        });

        expect(() => onboarding.markAsComplete()).toThrow(
          'Onboarding is already completed'
        );
      });

      it('should allow completion with no tasks', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          status: 'in_progress',
        });

        onboarding.markAsComplete();

        expect(onboarding.status).toBe('completed');
      });
    });

    describe('getTasksByCategory()', () => {
      it('should return tasks of specific category', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        const itTask1 = new OnboardingTask({
          name: 'Setup Laptop',
          category: 'it',
        });
        const itTask2 = new OnboardingTask({
          name: 'Setup Email',
          category: 'it',
        });
        const hrTask = new OnboardingTask({
          name: 'HR Orientation',
          category: 'hr',
        });

        onboarding.addTask(itTask1);
        onboarding.addTask(itTask2);
        onboarding.addTask(hrTask);

        const itTasks = onboarding.getTasksByCategory('it');

        expect(itTasks.length).toBe(2);
        expect(itTasks).toContain(itTask1);
        expect(itTasks).toContain(itTask2);
      });

      it('should return empty array for non-existent category', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
        });

        const task = new OnboardingTask({
          name: 'Task',
          category: 'it',
        });
        onboarding.addTask(task);

        const result = onboarding.getTasksByCategory('finance');

        expect(result).toEqual([]);
      });
    });

    describe('getAllowsOverride()', () => {
      it('should return true for budget > 3000', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          budget: 5000,
        });

        expect(onboarding.getAllowsOverride()).toBe(true);
      });

      it('should return false for budget <= 3000', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          budget: 3000,
        });

        expect(onboarding.getAllowsOverride()).toBe(false);
      });

      it('should return false for budget < 3000', () => {
        const onboarding = new Onboarding({
          employee_id: 1,
          start_date: new Date(),
          budget: 2000,
        });

        expect(onboarding.getAllowsOverride()).toBe(false);
      });
    });
  });
});
