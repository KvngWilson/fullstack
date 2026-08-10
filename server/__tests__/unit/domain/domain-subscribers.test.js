describe("Domain subscribers bootstrap", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("dispatches payment.succeeded to shipping subscriber", async () => {
    const dispatcher = require("../../../domain/shared/events/dispatcher");
    dispatcher.clear();

    const logger = require("../../../shared/utils/logger");
    const infoSpy = jest.spyOn(logger, "info").mockImplementation(() => {});

    const { registerDomainSubscribers } = require("../../../domain/subscribers");
    registerDomainSubscribers();

    await dispatcher.publish({
      type: "payment.succeeded",
      paymentId: 9001,
      orderId: 7001,
      userId: 42,
    });

    expect(infoSpy).toHaveBeenCalledWith(
      "Shipping subscriber received payment.succeeded",
      expect.objectContaining({
        eventType: "payment.succeeded",
        paymentId: 9001,
        orderId: 7001,
        userId: 42,
      }),
    );

    infoSpy.mockRestore();
  });

  test("registerDomainSubscribers is idempotent", () => {
    const dispatcher = require("../../../domain/shared/events/dispatcher");
    dispatcher.clear();

    const { registerDomainSubscribers } = require("../../../domain/subscribers");

    registerDomainSubscribers();
    registerDomainSubscribers();

    const shippingSubscribers = dispatcher.eventBus.getSubscribers("payment.succeeded");
    const catalogSubscribers = dispatcher.eventBus.getSubscribers("catalog.product.created");

    expect(shippingSubscribers).toHaveLength(1);
    expect(catalogSubscribers).toHaveLength(1);
  });

  test("registers websocket order subscriber when websocket manager is available", () => {
    const dispatcher = require("../../../domain/shared/events/dispatcher");
    dispatcher.clear();

    const { registerDomainSubscribers } = require("../../../domain/subscribers");

    registerDomainSubscribers({ websocketManager: {} });

    const orderSubscribers = dispatcher.eventBus.getSubscribers(
      "ordering.order.status.changed",
    );

    expect(orderSubscribers).toHaveLength(1);
  });
});
