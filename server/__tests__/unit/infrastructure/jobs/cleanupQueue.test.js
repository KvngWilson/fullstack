const CleanupQueue = require("../../../../infrastructure/jobs/handlers/cleanupQueue");

describe("CleanupQueue", () => {
  let queueMock;
  let dbPoolMock;
  let redisClientMock;

  beforeEach(() => {
    queueMock = { process: jest.fn() };
    dbPoolMock = { query: jest.fn() };
    redisClientMock = {
      scan: jest.fn(),
      del: jest.fn(),
    };
  });

  test("deletes expired idempotency keys", async () => {
    dbPoolMock.query.mockResolvedValueOnce({ rowCount: 4 });

    const cleanupQueue = new CleanupQueue(queueMock, dbPoolMock, redisClientMock);

    expect(queueMock.process).toHaveBeenCalledTimes(1);

    const result = await cleanupQueue.handle("expired-idempotency-keys", {});

    expect(result).toEqual({
      deleted: 4,
      type: "expired-idempotency-keys",
    });
    expect(dbPoolMock.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM idempotency_keys"),
    );
  });

  test("rejects unsupported cleanup jobs", async () => {
    const cleanupQueue = new CleanupQueue(queueMock, dbPoolMock, redisClientMock);

    await expect(cleanupQueue.handle("unknown", {})).rejects.toThrow(
      "Unsupported cleanup job type: unknown",
    );
  });
});
