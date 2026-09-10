/**
 * Onboarding domain value objects.
 * These are in-memory helpers for validation and state logic only;
 * persistence is handled by OnboardingService.
 */

class OnboardingTask {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.category = data.category === undefined ? "general" : data.category;
    this.due_day = data.due_day;
    this.assigned_to = data.assigned_to;
    this.is_completed = data.is_completed || false;
    this.completed_at = data.completed_at;
  }

  validate() {
    if (!this.name || this.name.trim() === "") {
      throw new Error("Task name is required");
    }
    if (!this.category) {
      throw new Error("Task category is required");
    }
    if (
      this.due_day !== undefined &&
      (this.due_day < 0 || this.due_day > 365)
    ) {
      throw new Error("Due day must be between 0 and 365");
    }
    return true;
  }

  markComplete(completedAt = new Date()) {
    if (this.is_completed) {
      throw new Error("Task already completed");
    }
    this.is_completed = true;
    this.completed_at = completedAt;
  }

  getStatus() {
    return this.is_completed ? "completed" : "pending";
  }
}

class Onboarding {
  constructor(data = {}) {
    this.id = data.id;
    this.employee_id = data.employee_id;
    this.start_date = data.start_date;
    this.end_date = data.end_date;
    this.status = data.status || "not_started";
    this.manager_id = data.manager_id;
    this.budget = data.budget ?? 5000;
    this.notes = data.notes;
    this.tasks = data.tasks || [];
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  validate() {
    if (!this.employee_id) {
      throw new Error("Employee ID is required");
    }
    if (!this.start_date) {
      throw new Error("Start date is required");
    }
    if (this.budget < 0) {
      throw new Error("Budget cannot be negative");
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
    if (this.status !== "not_started") {
      throw new Error("Onboarding can only be started from not_started status");
    }
    this.status = "in_progress";
    this.start_date = startDate;
  }

  markAsComplete() {
    if (this.status === "completed") {
      throw new Error("Onboarding is already completed");
    }
    const incompleteTasks = this.tasks.filter((t) => !t.is_completed);
    if (incompleteTasks.length > 0) {
      throw new Error(
        `Cannot mark as complete with ${incompleteTasks.length} pending tasks`,
      );
    }
    this.status = "completed";
    this.end_date = new Date();
  }

  getTasksByCategory(category) {
    return this.tasks.filter((t) => t.category === category);
  }

  getAllowsOverride() {
    return this.budget > 3000;
  }
}

module.exports = { Onboarding, OnboardingTask };
