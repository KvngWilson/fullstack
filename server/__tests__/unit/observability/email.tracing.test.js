describe("external email tracing instrumentation", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = "test";
  });

  test("creates an external call child span for SMTP sendMail", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "abc123" });

    jest.doMock("nodemailer", () => ({
      createTransport: jest.fn(() => ({ sendMail })),
    }));

    const tracingContext = {
      startSpan: jest.fn(() => ({ tags: {}, logs: [] })),
      addTag: jest.fn(),
      addLog: jest.fn(),
      endSpan: jest.fn(),
    };

    const tracingScope = require("../../../infrastructure/observability/tracing/tracingScope");
    const { sendEmail } = require("../../../infrastructure/email/email");

    await tracingScope.runWithTracingContext({ tracingContext }, async () => {
      const result = await sendEmail({
        to: "dev@ashbourne.dev",
        subject: "Tracing Test",
        html: "<p>Tracing</p>",
      });
      expect(result.success).toBe(true);
    });

    expect(sendMail).toHaveBeenCalled();
    expect(tracingContext.startSpan).toHaveBeenCalledWith("external.email.send");
    expect(tracingContext.addTag).toHaveBeenCalledWith(
      expect.any(Object),
      "external.system",
      "smtp",
    );
    expect(tracingContext.endSpan).toHaveBeenCalled();
  });
});
