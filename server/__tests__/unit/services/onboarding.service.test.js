/**
 * OnboardingService Unit Tests
 */

jest.mock("../../../config/db", () => ({ pool: { query: jest.fn() } }));
jest.mock("../../../config/redis", () => ({ redisClient: { isReady: false } }));
jest.mock("../../../shared/utils/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { pool } = require("../../../config/db");
const OnboardingService = require("../../../services/onboarding");

const mockOnboarding = (overrides = {}) => ({
  id: 1, employee_id: 1, manager_id: 5, status: "not_started",
  start_date: "2024-01-15", budget: "5000", budget_spent: "0",
  notes: null, ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe("OnboardingService", () => {
  describe("createOnboarding", () => {
    it("creates onboarding when employee exists", async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })   // employee check
        .mockResolvedValueOnce({ rows: [mockOnboarding()] });          // insert

      const result = await OnboardingService.createOnboarding({
        employeeId: 1, startDate: "2024-01-15", budget: 5000,
      });

      expect(result.employee_id).toBe(1);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it("throws ValidationError when employeeId is missing", async () => {
      await expect(
        OnboardingService.createOnboarding({ startDate: "2024-01-15" })
      ).rejects.toThrow("Employee ID is required");
    });

    it("throws ValidationError for negative budget", async () => {
      await expect(
        OnboardingService.createOnboarding({ employeeId: 1, startDate: "2024-01-15", budget: -100 })
      ).rejects.toThrow("Budget cannot be negative");
    });

    it("throws NotFoundError when employee does not exist", async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await expect(
        OnboardingService.createOnboarding({ employeeId: 999, startDate: "2024-01-15" })
      ).rejects.toThrow("Employee not found");
    });

    it("uses default budget of 5000 when not provided", async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [mockOnboarding()] });

      await OnboardingService.createOnboarding({ employeeId: 1, startDate: "2024-01-15" });

      const insertCall = pool.query.mock.calls[1];
      expect(insertCall[1][3]).toBe(5000); // 4th param is budget
    });
  });

  describe("startOnboarding", () => {
    it("transitions not_started → in_progress", async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [mockOnboarding({ status: "not_started" })] })
        .mockResolvedValueOnce({ rows: [mockOnboarding({ status: "in_progress" })] });

      const result = await OnboardingService.startOnboarding(1);
      expect(result.status).toBe("in_progress");
    });

    it("throws ValidationError when already in_progress", async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [mockOnboarding({ status: "in_progress" })] });

      await expect(OnboardingService.startOnboarding(1)).rejects.toThrow(
        "Onboarding must be in not_started status"
      );
    });
  });

  describe("completeOnboarding", () => {
    it("transitions in_progress → completed when no pending tasks", async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [mockOnboarding({ status: "in_progress" })] }) // fetchOnboarding
        .mockResolvedValueOnce({ rows: [{ pending: "0" }] })                                        // countPendingTasks
        .mockResolvedValueOnce({ rows: [mockOnboarding({ status: "completed" })] });                // update

      const result = await OnboardingService.completeOnboarding(1);
      expect(result.status).toBe("completed");
    });

    it("throws ValidationError when pending tasks exist", async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [mockOnboarding({ status: "in_progress" })] })
        .mockResolvedValueOnce({ rows: [{ pending: "2" }] });

      await expect(OnboardingService.completeOnboarding(1)).rejects.toThrow(
        "Cannot complete with 2 pending tasks"
      );
    });
  });

  describe("addTask", () => {
    it("creates a task with valid inputs", async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [mockOnboarding()] }) // fetchOnboarding
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "IT Setup", category: "it", is_completed: false }] });

      const result = await OnboardingService.addTask(1, { name: "IT Setup", category: "it" });
      expect(result.name).toBe("IT Setup");
      expect(result.is_completed).toBe(false);
    });

    it("throws ValidationError for missing task name", async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [mockOnboarding()] });

      await expect(OnboardingService.addTask(1, { category: "it" })).rejects.toThrow(
        "Task name is required"
      );
    });

    it("throws ValidationError for due_day > 365", async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [mockOnboarding()] });

      await expect(
        OnboardingService.addTask(1, { name: "Task", category: "it", dueDay: 400 })
      ).rejects.toThrow("Due day must be between 0 and 365");
    });
  });

  describe("completeTask", () => {
    it("marks a task as completed", async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, is_completed: false }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_completed: true, completed_at: new Date() }] });

      const result = await OnboardingService.completeTask(1, 1);
      expect(result.is_completed).toBe(true);
    });

    it("throws ValidationError for already-completed task", async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, is_completed: true }] });

      await expect(OnboardingService.completeTask(1, 1)).rejects.toThrow("already completed");
    });
  });

  describe("applyBudgetOverride", () => {
    it("applies override when budget > 3000", async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [mockOnboarding({ budget: "5000" })] })
        .mockResolvedValueOnce({ rows: [mockOnboarding({ budget: "7500", budget_overridden: true })] });

      const result = await OnboardingService.applyBudgetOverride(1, 7500, "Additional training");
      expect(result.budget_overridden).toBe(true);
    });

    it("throws ValidationError when new budget is not positive", async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [mockOnboarding({ budget: "5000" })] });

      await expect(OnboardingService.applyBudgetOverride(1, -500, "reason")).rejects.toThrow(
        "New budget must be positive"
      );
    });

    it("throws ValidationError when current budget <= 3000", async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [mockOnboarding({ budget: "2000" })] });

      await expect(OnboardingService.applyBudgetOverride(1, 3000, "reason")).rejects.toThrow(
        "Budget override not allowed"
      );
    });
  });
});
