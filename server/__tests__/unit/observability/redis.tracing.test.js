describe("redis tracing instrumentation", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = "test";
  });

  test("creates a redis child span for commands when request tracing context exists", async () => {
    const baseSendCommand = jest.fn().mockResolvedValue("OK");
    const fakeClient = {
      sendCommand: baseSendCommand,
      connect: jest.fn(),
      on: jest.fn(),
      isOpen: false,
    };

    jest.doMock("redis", () => ({
      createClient: jest.fn(() => fakeClient),
    }));

    const tracingContext = {
      startSpan: jest.fn(() => ({ tags: {}, logs: [] })),
      addTag: jest.fn(),
      addLog: jest.fn(),
      endSpan: jest.fn(),
    };

    const tracingScope = require("../../../infrastructure/observability/tracing/tracingScope");
    const { redisClient } = require("../../../config/redis");

    await tracingScope.runWithTracingContext({ tracingContext }, async () => {
      await redisClient.sendCommand({ args: ["GET", "session:1"] });
    });

    expect(baseSendCommand).toHaveBeenCalledWith({
      args: ["GET", "session:1"],
    }, undefined);
    expect(tracingContext.startSpan).toHaveBeenCalledWith("redis.command");
    expect(tracingContext.addTag).toHaveBeenCalledWith(
      expect.any(Object),
      "db.system",
      "redis",
    );
    expect(tracingContext.addTag).toHaveBeenCalledWith(
      expect.any(Object),
      "db.operation",
      "GET",
    );
    expect(tracingContext.endSpan).toHaveBeenCalled();
  });
});
