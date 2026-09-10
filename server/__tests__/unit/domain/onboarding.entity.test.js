/**
 * Onboarding Entity Unit Tests
 */

const { Onboarding, OnboardingTask } = require("../../../domain/onboarding/entities");

describe("Onboarding Entity", () => {
  describe("OnboardingTask", () => {
    describe("constructor", () => {
      it("should create task with required fields", () => {
        const task = new OnboardingTask({ id: 1, name: "IT Setup", description: "Setup laptop", category: "it", due_day: 1 });
        expect(task.name).toBe("IT Setup");
        expect(task.category).toBe("it");
        expect(task.due_day).toBe(1);
      });

      it("should set default category to general", () => {
        const task = new OnboardingTask({ name: "Review handbook" });
        expect(task.category).toBe("general");
      });

      it("should set default is_completed to false", () => {
        expect(new OnboardingTask({ name: "Task" }).is_completed).toBe(false);
      });
    });

    describe("validate()", () => {
      it("should validate successful task", () => {
        expect(new OnboardingTask({ name: "IT Setup", category: "it", due_day: 1 }).validate()).toBe(true);
      });

      it("should reject missing task name", () => {
        expect(() => new OnboardingTask({ category: "it" }).validate()).toThrow("Task name is required");
      });

      it("should reject empty task name", () => {
        expect(() => new OnboardingTask({ name: "   ", category: "it" }).validate()).toThrow("Task name is required");
      });

      it("should reject missing category", () => {
        expect(() => new OnboardingTask({ name: "Task", category: "" }).validate()).toThrow("Task category is required");
      });

      it("should reject due_day < 0", () => {
        expect(() => new OnboardingTask({ name: "Task", category: "it", due_day: -1 }).validate()).toThrow("Due day must be between 0 and 365");
      });

      it("should reject due_day > 365", () => {
        expect(() => new OnboardingTask({ name: "Task", category: "it", due_day: 366 }).validate()).toThrow("Due day must be between 0 and 365");
      });

      it("should accept valid due_day values", () => {
        [0, 1, 90, 180, 365].forEach((dueDay) => {
          expect(new OnboardingTask({ name: "Task", category: "it", due_day: dueDay }).validate()).toBe(true);
        });
      });
    });

    describe("markComplete()", () => {
      it("should mark task as complete", () => {
        const task = new OnboardingTask({ name: "Task", category: "it" });
        task.markComplete();
        expect(task.is_completed).toBe(true);
        expect(task.completed_at).toBeDefined();
      });

      it("should reject marking already completed task", () => {
        const task = new OnboardingTask({ name: "Task", category: "it", is_completed: true });
        expect(() => task.markComplete()).toThrow("Task already completed");
      });

      it("should set completion time", () => {
        const task = new OnboardingTask({ name: "Task", category: "it" });
        const completionTime = new Date("2024-02-15 10:30:00");
        task.markComplete(completionTime);
        expect(task.completed_at).toEqual(completionTime);
      });
    });

    describe("getStatus()", () => {
      it("should return pending for incomplete task", () => {
        expect(new OnboardingTask({ name: "Task", is_completed: false }).getStatus()).toBe("pending");
      });

      it("should return completed for complete task", () => {
        expect(new OnboardingTask({ name: "Task", is_completed: true }).getStatus()).toBe("completed");
      });
    });
  });

  describe("Onboarding", () => {
    describe("constructor", () => {
      it("should create onboarding with required fields", () => {
        const o = new Onboarding({ id: 1, employee_id: 1, start_date: new Date("2024-01-15"), manager_id: 5 });
        expect(o.employee_id).toBe(1);
        expect(o.manager_id).toBe(5);
      });

      it("should set default status to not_started", () => {
        expect(new Onboarding({ employee_id: 1, start_date: new Date() }).status).toBe("not_started");
      });

      it("should set default budget to 5000", () => {
        expect(new Onboarding({ employee_id: 1, start_date: new Date() }).budget).toBe(5000);
      });

      it("should initialize empty tasks array", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date() });
        expect(Array.isArray(o.tasks)).toBe(true);
        expect(o.tasks.length).toBe(0);
      });

      it("should accept custom budget", () => {
        expect(new Onboarding({ employee_id: 1, start_date: new Date(), budget: 10000 }).budget).toBe(10000);
      });
    });

    describe("validate()", () => {
      it("should validate successful onboarding", () => {
        expect(new Onboarding({ employee_id: 1, start_date: new Date("2024-01-15") }).validate()).toBe(true);
      });

      it("should reject missing employee_id", () => {
        expect(() => new Onboarding({ start_date: new Date() }).validate()).toThrow("Employee ID is required");
      });

      it("should reject missing start_date", () => {
        expect(() => new Onboarding({ employee_id: 1 }).validate()).toThrow("Start date is required");
      });

      it("should reject negative budget", () => {
        expect(() => new Onboarding({ employee_id: 1, start_date: new Date(), budget: -1000 }).validate()).toThrow("Budget cannot be negative");
      });

      it("should accept zero budget", () => {
        expect(new Onboarding({ employee_id: 1, start_date: new Date(), budget: 0 }).validate()).toBe(true);
      });
    });

    describe("addTask()", () => {
      it("should add valid task to onboarding", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date() });
        const task = new OnboardingTask({ name: "IT Setup", category: "it" });
        o.addTask(task);
        expect(o.tasks.length).toBe(1);
      });

      it("should reject invalid task", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date() });
        expect(() => o.addTask(new OnboardingTask({ category: "it" }))).toThrow("Task name is required");
      });

      it("should add multiple tasks", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date() });
        o.addTask(new OnboardingTask({ name: "IT Setup", category: "it" }));
        o.addTask(new OnboardingTask({ name: "HR Orientation", category: "hr" }));
        expect(o.tasks.length).toBe(2);
      });
    });

    describe("getCompletionPercentage()", () => {
      it("should return 0 when no tasks exist", () => {
        expect(new Onboarding({ employee_id: 1, start_date: new Date() }).getCompletionPercentage()).toBe(0);
      });

      it("should return 50 when half tasks are completed", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date() });
        o.addTask(new OnboardingTask({ name: "Task 1", category: "it", is_completed: true }));
        o.addTask(new OnboardingTask({ name: "Task 2", category: "hr" }));
        expect(o.getCompletionPercentage()).toBe(50);
      });

      it("should return 100 when all tasks are completed", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date() });
        o.addTask(new OnboardingTask({ name: "Task 1", category: "it", is_completed: true }));
        o.addTask(new OnboardingTask({ name: "Task 2", category: "hr", is_completed: true }));
        expect(o.getCompletionPercentage()).toBe(100);
      });

      it("should round down completion percentage", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date() });
        o.addTask(new OnboardingTask({ name: "T1", category: "it", is_completed: true }));
        o.addTask(new OnboardingTask({ name: "T2", category: "hr" }));
        o.addTask(new OnboardingTask({ name: "T3", category: "general" }));
        expect(o.getCompletionPercentage()).toBe(33);
      });
    });

    describe("markAsStarted()", () => {
      it("should mark onboarding as started", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date(), status: "not_started" });
        const startDate = new Date();
        o.markAsStarted(startDate);
        expect(o.status).toBe("in_progress");
        expect(o.start_date).toEqual(startDate);
      });

      it("should reject starting onboarding not in not_started status", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date(), status: "in_progress" });
        expect(() => o.markAsStarted()).toThrow("Onboarding can only be started from not_started status");
      });
    });

    describe("markAsComplete()", () => {
      it("should mark onboarding as complete", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date(), status: "in_progress" });
        o.addTask(new OnboardingTask({ name: "Task 1", is_completed: true }));
        o.markAsComplete();
        expect(o.status).toBe("completed");
        expect(o.end_date).toBeDefined();
      });

      it("should reject marking complete with pending tasks", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date(), status: "in_progress" });
        o.addTask(new OnboardingTask({ name: "Task 1", is_completed: true }));
        o.addTask(new OnboardingTask({ name: "Task 2", is_completed: false }));
        expect(() => o.markAsComplete()).toThrow("Cannot mark as complete with 1 pending tasks");
      });

      it("should reject marking already completed onboarding", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date(), status: "completed", end_date: new Date() });
        expect(() => o.markAsComplete()).toThrow("Onboarding is already completed");
      });

      it("should allow completion with no tasks", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date(), status: "in_progress" });
        o.markAsComplete();
        expect(o.status).toBe("completed");
      });
    });

    describe("getTasksByCategory()", () => {
      it("should return tasks of specific category", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date() });
        const itTask1 = new OnboardingTask({ name: "Setup Laptop", category: "it" });
        const itTask2 = new OnboardingTask({ name: "Setup Email", category: "it" });
        const hrTask  = new OnboardingTask({ name: "HR Orientation", category: "hr" });
        o.addTask(itTask1);
        o.addTask(itTask2);
        o.addTask(hrTask);
        const itTasks = o.getTasksByCategory("it");
        expect(itTasks.length).toBe(2);
        expect(itTasks).toContain(itTask1);
      });

      it("should return empty array for non-existent category", () => {
        const o = new Onboarding({ employee_id: 1, start_date: new Date() });
        o.addTask(new OnboardingTask({ name: "Task", category: "it" }));
        expect(o.getTasksByCategory("finance")).toEqual([]);
      });
    });

    describe("getAllowsOverride()", () => {
      it("should return true for budget > 3000", () => {
        expect(new Onboarding({ employee_id: 1, start_date: new Date(), budget: 5000 }).getAllowsOverride()).toBe(true);
      });

      it("should return false for budget <= 3000", () => {
        expect(new Onboarding({ employee_id: 1, start_date: new Date(), budget: 3000 }).getAllowsOverride()).toBe(false);
      });
    });
  });
});
