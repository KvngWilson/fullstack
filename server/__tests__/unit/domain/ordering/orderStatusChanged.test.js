const OrderStatusChanged = require("../../../../domain/ordering/events/OrderStatusChanged");
const OrderStatusChangedSubscriber = require("../../../../domain/subscribers/OrderStatusChangedSubscriber");

describe("OrderStatusChanged", () => {
  it("normalizes legacy fulfilled events to shipped semantics", () => {
    const event = new OrderStatusChanged({
      orderId: 10,
      userId: 20,
      previousStatus: "paid",
      newStatus: "fulfilled",
    });

    expect(event.getNormalizedStatus()).toBe("shipped");
    expect(event.getStatusMessage()).toBe("Order shipped");
    expect(event.shouldNotifyAdmin()).toBe(true);
    expect(event.getNotificationPriority()).toBe("medium");
  });
});

describe("OrderStatusChangedSubscriber", () => {
  let websocketManager;
  let emailService;
  let repository;

  beforeEach(() => {
    websocketManager = {
      emitOrderStatusUpdate: jest.fn(),
      broadcastToAdmin: jest.fn(),
    };
    emailService = {
      queueEmail: jest.fn().mockResolvedValue(undefined),
    };
    repository = {
      findById: jest.fn().mockResolvedValue({ id: 11, user_id: 22 }),
      getUserById: jest.fn().mockResolvedValue({ email: "customer@example.com" }),
    };
  });

  it("queues the shipped template for current shipped status", async () => {
    const subscriber = new OrderStatusChangedSubscriber(
      websocketManager,
      emailService,
      repository,
    );
    const event = new OrderStatusChanged({
      orderId: 11,
      userId: 22,
      previousStatus: "paid",
      newStatus: "shipped",
    });

    await subscriber.handle(event);

    expect(emailService.queueEmail).toHaveBeenCalledWith(
      "customer@example.com",
      "orderShipped",
      expect.objectContaining({
        status: "shipped",
        orderUrl: expect.stringContaining("/orders/11"),
      }),
    );
    expect(websocketManager.broadcastToAdmin).toHaveBeenCalledWith(
      "order-status-changed",
      expect.objectContaining({
        newStatus: "shipped",
      }),
    );
  });

  it("queues the delivered template and runs delivered side effects", async () => {
    const subscriber = new OrderStatusChangedSubscriber(
      websocketManager,
      emailService,
      repository,
    );
    const deliveredSpy = jest.spyOn(subscriber, "_handleOrderDelivered");
    const event = new OrderStatusChanged({
      orderId: 11,
      userId: 22,
      previousStatus: "shipped",
      newStatus: "delivered",
    });

    await subscriber.handle(event);

    expect(emailService.queueEmail).toHaveBeenCalledWith(
      "customer@example.com",
      "orderDelivered",
      expect.objectContaining({
        status: "delivered",
      }),
    );
    expect(deliveredSpy).toHaveBeenCalled();
  });
});
