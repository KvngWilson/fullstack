/**
 * InventoryRepository Optimistic Locking Unit Tests
 *
 * Tests the version-based stock reservation added in Sprint 2:
 * - Successful reservation decrements stock and bumps version
 * - Missing variant and insufficient stock are reported without retrying
 * - Version conflicts retry, then give up after maxRetries
 * - releaseStock returns stock and bumps version
 */

jest.mock("../../shared/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../config/db", () => ({
  pool: { query: jest.fn() },
}));

const inventoryRepository = require("../../domain/catalog/repositories/InventoryRepository");

describe("InventoryRepository - optimistic locking", () => {
  let executor;

  beforeEach(() => {
    executor = { query: jest.fn() };
  });

  describe("reserveStockWithOptimisticLock", () => {
    it("reserves stock when the version is unchanged", async () => {
      executor.query
        .mockResolvedValueOnce({ rows: [{ id: 1, stock: 10, version: 4 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, stock: 7, version: 5 }] });

      const result = await inventoryRepository.reserveStockWithOptimisticLock(
        executor,
        { variantId: 1, quantity: 3 },
      );

      expect(result).toEqual({
        reserved: true,
        variant: { id: 1, stock: 7, version: 5 },
      });

      const updateCall = executor.query.mock.calls[1];
      expect(updateCall[0]).toMatch(/version = version \+ 1/);
      expect(updateCall[1]).toEqual([3, 1, 4]);
    });

    it("reports not_found for a missing variant", async () => {
      executor.query.mockResolvedValueOnce({ rows: [] });

      const result = await inventoryRepository.reserveStockWithOptimisticLock(
        executor,
        { variantId: 999, quantity: 1 },
      );

      expect(result).toEqual({ reserved: false, reason: "not_found" });
      expect(executor.query).toHaveBeenCalledTimes(1);
    });

    it("reports insufficient_stock without attempting the update", async () => {
      executor.query.mockResolvedValueOnce({
        rows: [{ id: 1, stock: 2, version: 0 }],
      });

      const result = await inventoryRepository.reserveStockWithOptimisticLock(
        executor,
        { variantId: 1, quantity: 5 },
      );

      expect(result).toEqual({ reserved: false, reason: "insufficient_stock" });
      expect(executor.query).toHaveBeenCalledTimes(1);
    });

    it("retries on version conflict and succeeds on a later attempt", async () => {
      executor.query
        // Attempt 1: read version 4, but a concurrent writer bumps it
        .mockResolvedValueOnce({ rows: [{ id: 1, stock: 10, version: 4 }] })
        .mockResolvedValueOnce({ rows: [] })
        // Attempt 2: re-read sees version 5, update succeeds
        .mockResolvedValueOnce({ rows: [{ id: 1, stock: 9, version: 5 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, stock: 6, version: 6 }] });

      const result = await inventoryRepository.reserveStockWithOptimisticLock(
        executor,
        { variantId: 1, quantity: 3 },
      );

      expect(result.reserved).toBe(true);
      expect(result.variant.version).toBe(6);
      expect(executor.query).toHaveBeenCalledTimes(4);
    });

    it("gives up with version_conflict after exhausting retries", async () => {
      executor.query.mockImplementation((sql) => {
        if (/SELECT/.test(sql)) {
          return Promise.resolve({ rows: [{ id: 1, stock: 10, version: 4 }] });
        }
        return Promise.resolve({ rows: [] }); // update always loses the race
      });

      const result = await inventoryRepository.reserveStockWithOptimisticLock(
        executor,
        { variantId: 1, quantity: 3 },
        { maxRetries: 2 },
      );

      expect(result).toEqual({ reserved: false, reason: "version_conflict" });
      // 3 attempts (initial + 2 retries) x 2 queries each
      expect(executor.query).toHaveBeenCalledTimes(6);
    });
  });

  describe("releaseStock", () => {
    it("returns stock and bumps the version", async () => {
      executor.query.mockResolvedValueOnce({
        rows: [{ id: 1, stock: 12, version: 7 }],
      });

      const result = await inventoryRepository.releaseStock(executor, {
        variantId: 1,
        quantity: 2,
      });

      expect(result).toEqual({ id: 1, stock: 12, version: 7 });
      const [sql, params] = executor.query.mock.calls[0];
      expect(sql).toMatch(/stock = stock \+ \$1/);
      expect(sql).toMatch(/version = version \+ 1/);
      expect(params).toEqual([2, 1]);
    });

    it("returns null when the variant does not exist", async () => {
      executor.query.mockResolvedValueOnce({ rows: [] });

      const result = await inventoryRepository.releaseStock(executor, {
        variantId: 999,
        quantity: 2,
      });

      expect(result).toBeNull();
    });
  });
});
