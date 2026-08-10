// stripe.service.test.js

const crypto = require("crypto");

// ---- Mock Stripe BEFORE import ----
const mockCreateIntent = jest.fn();
const mockRetrieveIntent = jest.fn();
const mockConstructEvent = jest.fn();
const mockRefundCreate = jest.fn();

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockCreateIntent,
      retrieve: mockRetrieveIntent,
    },
    refunds: {
      create: mockRefundCreate,
    },
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }));
});

// ---- Import Service Layer ----
const domain = require("../../domain");
const {
  createPaymentIntent,
  verifyPaymentIntent,
  refundPayment,
  validateStripeWebhook,
} = domain.payment.services.PaymentService;

describe("Stripe Payment Service - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  // ===============================
  // CREATE PAYMENT INTENT
  // ===============================
  describe("createPaymentIntent", () => {
    it("creates payment intent with minor units", async () => {
      mockCreateIntent.mockResolvedValue({
        id: "pi_123",
        amount: 15000,
        currency: "usd",
        status: "requires_payment_method",
        client_secret: "secret_123",
      });

      const result = await createPaymentIntent({
        amount: 150,
        currency: "usd",
        metadata: { orderId: "1" },
      });

      expect(mockCreateIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15000,
          currency: "usd",
          metadata: { orderId: "1" },
        }),
        expect.any(Object),
      );

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("pi_123");
    });

    it("rejects negative amounts", async () => {
      await expect(
        createPaymentIntent({ amount: -10, currency: "usd" }),
      ).rejects.toThrow();
    });

    it("handles Stripe API errors", async () => {
      mockCreateIntent.mockRejectedValue(new Error("Stripe down"));

      const result = await createPaymentIntent({
        amount: 100,
        currency: "usd",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Stripe down");
    });
  });

  // ===============================
  // VERIFY PAYMENT INTENT
  // ===============================
  describe("verifyPaymentIntent", () => {
    it("returns success when status is succeeded", async () => {
      mockRetrieveIntent.mockResolvedValue({
        id: "pi_123",
        status: "succeeded",
        amount: 20000,
        currency: "usd",
      });

      const result = await verifyPaymentIntent("pi_123");

      expect(result.success).toBe(true);
      expect(result.data.amount).toBe(200); // back to major units
    });

    it("returns failure for non-succeeded status", async () => {
      mockRetrieveIntent.mockResolvedValue({
        id: "pi_123",
        status: "requires_payment_method",
      });

      const result = await verifyPaymentIntent("pi_123");

      expect(result.success).toBe(false);
    });

    it("handles retrieve errors", async () => {
      mockRetrieveIntent.mockRejectedValue(new Error("Not found"));

      const result = await verifyPaymentIntent("invalid");

      expect(result.success).toBe(false);
    });
  });

  // ===============================
  // REFUND PAYMENT
  // ===============================
  describe("refundPayment", () => {
    it("creates refund successfully", async () => {
      mockRefundCreate.mockResolvedValue({
        id: "re_123",
        amount: 10000,
        status: "succeeded",
      });

      const result = await refundPayment("pi_123", 100);

      expect(mockRefundCreate).toHaveBeenCalledWith({
        payment_intent: "pi_123",
        amount: 10000,
      });

      expect(result.success).toBe(true);
    });

    it("handles refund errors", async () => {
      mockRefundCreate.mockRejectedValue(new Error("Refund failed"));

      const result = await refundPayment("pi_123", 100);

      expect(result.success).toBe(false);
    });
  });

  // ===============================
  // WEBHOOK VALIDATION
  // ===============================
  describe("validateStripeWebhook", () => {
    it("constructs event successfully", () => {
      const payload = JSON.stringify({ type: "payment_intent.succeeded" });
      const signature = "valid_signature";

      mockConstructEvent.mockReturnValue({
        type: "payment_intent.succeeded",
      });

      const event = validateStripeWebhook(payload, signature);

      expect(mockConstructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );

      expect(event.type).toBe("payment_intent.succeeded");
    });

    it("throws on invalid signature", () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const payload = JSON.stringify({});
      const signature = "invalid";

      expect(() => validateStripeWebhook(payload, signature)).toThrow(
        "Invalid signature",
      );
    });
  });
});
