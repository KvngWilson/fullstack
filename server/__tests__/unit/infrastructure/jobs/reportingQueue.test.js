const ReportingQueue = require("../../../../infrastructure/jobs/handlers/reportingQueue");

describe("ReportingQueue", () => {
  let queueMock;
  let dbPoolMock;
  let redisClientMock;

  beforeEach(() => {
    queueMock = { process: jest.fn() };
    dbPoolMock = { query: jest.fn() };
    redisClientMock = { setEx: jest.fn().mockResolvedValue("OK") };
  });

  test("registers a processor and produces a dashboard overview", async () => {
    dbPoolMock.query
      .mockResolvedValueOnce({ rows: [{ revenue: "120.50" }] })
      .mockResolvedValueOnce({ rows: [{ count: "3" }] })
      .mockResolvedValueOnce({ rows: [{ avg_value: "40.17" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const reportingQueue = new ReportingQueue(queueMock, dbPoolMock, redisClientMock);

    expect(queueMock.process).toHaveBeenCalledTimes(1);

    const result = await reportingQueue.handle("dashboard-overview", {
      timeRange: "today",
    });

    expect(result.totalRevenue).toBe(120.5);
    expect(result.orderCount).toBe(3);
    expect(redisClientMock.setEx).toHaveBeenCalled();
  });

  test("rejects unsupported reporting jobs", async () => {
    const reportingQueue = new ReportingQueue(queueMock, dbPoolMock, redisClientMock);

    await expect(reportingQueue.handle("unknown", {})).rejects.toThrow(
      "Unsupported reporting job type: unknown",
    );
  });
});
