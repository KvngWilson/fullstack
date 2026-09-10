describe("database tracing instrumentation", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = "test";
  });

  test("creates a db child span for queries when request tracing context exists", async () => {
    const baseQuery = jest
      .fn()
      .mockResolvedValue({ rows: [{ value: 1 }], rowCount: 1 });
    const fakePool = {
      query: baseQuery,
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
      options: { max: 10, min: 1 },
    };

    jest.doMock("pg", () => ({
      Pool: jest.fn(() => fakePool),
    }));

    const tracingContext = {
      startSpan: jest.fn(() => ({ tags: {}, logs: [] })),
      addTag: jest.fn(),
      addLog: jest.fn(),
      endSpan: jest.fn(),
    };

    const tracingScope = require("../../../infrastructure/observability/tracing/tracingScope");
    const db = require("../../../config/db");

    await tracingScope.runWithTracingContext({ tracingContext }, async () => {
      await db.query("SELECT 1");
    });

    expect(baseQuery).toHaveBeenCalledWith("SELECT 1");
    expect(tracingContext.startSpan).toHaveBeenCalledWith("db.query");
    expect(tracingContext.addTag).toHaveBeenCalledWith(
      expect.any(Object),
      "db.system",
      "postgresql",
    );
    expect(tracingContext.addTag).toHaveBeenCalledWith(
      expect.any(Object),
      "db.operation",
      "select",
    );
    expect(tracingContext.endSpan).toHaveBeenCalled();
  });
});
