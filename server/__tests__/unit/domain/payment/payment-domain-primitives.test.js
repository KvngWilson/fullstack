const PaymentInitiated = require("../../../../domain/payment/events/PaymentInitiated");
const PaymentSucceeded = require("../../../../domain/payment/events/PaymentSucceeded");
const PaymentFailed = require("../../../../domain/payment/events/PaymentFailed");
const RefundProcessed = require("../../../../domain/payment/events/RefundProcessed");
const PaymentValidationPolicy = require("../../../../domain/payment/policies/PaymentValidationPolicy");

describe("Payment domain primitives", () => {
  describe("events", () => {
    test("PaymentInitiated maps constructor payload", () => {
      const occurredAt = new Date("2026-01-01T00:00:00.000Z");
      const event = new PaymentInitiated({
        paymentId: 11,
        orderId: 22,
        userId: 33,
        amount: "100.50",
        currency: "USD",
        processor: "stripe",
        occurredAt,
      });

      expect(event.type).toBe("payment.initiated");
      expect(event.paymentId).toBe(11);
      expect(event.orderId).toBe(22);
      expect(event.userId).toBe(33);
      expect(event.amount).toBe(100.5);
      expect(event.currency).toBe("USD");
      expect(event.processor).toBe("stripe");
      expect(event.occurredAt).toBe(occurredAt);
    });

    test("PaymentSucceeded maps constructor payload", () => {
      const event = new PaymentSucceeded({
        paymentId: 101,
        orderId: 201,
        userId: 301,
        amount: 75,
        transactionId: "txn_123",
      });

      expect(event.type).toBe("payment.succeeded");
      expect(event.transactionId).toBe("txn_123");
      expect(event.amount).toBe(75);
    });

    test("PaymentFailed maps reason and defaults", () => {
      const event = new PaymentFailed({
        paymentId: 7,
        orderId: 8,
        userId: 9,
        amount: 19.99,
      });

      expect(event.type).toBe("payment.failed");
      expect(event.reason).toBe("unknown_error");
      expect(event.currency).toBe("USD");
    });

    test("RefundProcessed maps refund payload", () => {
      const event = new RefundProcessed({
        refundId: 501,
        paymentId: 401,
        orderId: 301,
        userId: 201,
        amount: "20.00",
        status: "completed",
      });

      expect(event.type).toBe("payment.refund.processed");
      expect(event.refundId).toBe(501);
      expect(event.paymentId).toBe(401);
      expect(event.orderId).toBe(301);
      expect(event.userId).toBe(201);
      expect(event.amount).toBe(20);
      expect(event.status).toBe("completed");
    });
  });

  describe("PaymentValidationPolicy", () => {
    test("accepts supported currency and processor", () => {
      expect(PaymentValidationPolicy.isSupportedCurrency("usd")).toBe(true);
      expect(PaymentValidationPolicy.isSupportedProcessor("STRIPE")).toBe(true);
    });

    test("rejects unsupported currency and processor", () => {
      expect(PaymentValidationPolicy.isSupportedCurrency("BTC")).toBe(false);
      expect(PaymentValidationPolicy.isSupportedProcessor("bank_transfer")).toBe(false);
    });

    test("validates create-payment payload", () => {
      const result = PaymentValidationPolicy.validateCreatePayment({
        orderId: 123,
        amount: 49.99,
        currency: "USD",
        processor: "stripe",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("returns errors for invalid create-payment payload", () => {
      const result = PaymentValidationPolicy.validateCreatePayment({
        orderId: 0,
        amount: -1,
        currency: "XYZ",
        processor: "invalid",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "orderId must be a positive integer",
          "amount must be greater than 0",
          "currency is not supported",
          "processor is not supported",
        ]),
      );
    });

    test("validates refund amount against remaining balance", () => {
      const result = PaymentValidationPolicy.validateRefundAmount(100, 20, 30);

      expect(result.valid).toBe(true);
      expect(result.remaining).toBe(80);
    });

    test("rejects refund amount above remaining balance", () => {
      const result = PaymentValidationPolicy.validateRefundAmount(100, 80, 25);

      expect(result.valid).toBe(false);
      expect(result.message).toContain("exceeds remaining balance");
    });
  });
});
