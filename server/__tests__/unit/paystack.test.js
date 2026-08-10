// payment.service.test.js

const crypto = require("crypto");

// ---- Mock SDK BEFORE imports ----
const mockInitialize = jest.fn();
const mockVerify = jest.fn();
const mockList = jest.fn();
const mockCreate = jest.fn();

jest.mock("@paystack/paystack-sdk", () => {
  return jest.fn().mockImplementation(() => ({
    transaction: {
      initialize: mockInitialize,
      verify: mockVerify,
      list: mockList,
    },
    refund: {
      create: mockCreate,
    },
  }));
});

// ---- Import Service Layer (NOT controller) ----
const domain = require("../../domain");
const {
  initializePayment,
  verifyPayment,
  getTransaction,
  generateReference,
  validateWebhookSignature,
} = domain.payment.services.PaymentService;

describe("Payment Service - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initializePayment", () => {
    const validParams = {
      email: "customer@example.com",
      amount: 100,
      reference: "TEST-REF-123",
      currency: "USD",
      metadata: { order_id: 1 },
    };

    it("converts amount safely to minor units", async () => {
      mockInitialize.mockResolvedValue({
        data: { authorization_url: "", access_code: "", reference: "" },
      });

      await initializePayment(validParams);

      const callArgs = mockInitialize.mock.calls[0][0];
      expect(callArgs.amount).toBe(10000);
    });

    it("defaults currency when missing", async () => {
      const input = { ...validParams };
      delete input.currency;

      mockInitialize.mockResolvedValue({ data: {} });

      await initializePayment(input);

      const callArgs = mockInitialize.mock.calls[0][0];
      expect(callArgs.currency).toBe("USD");
    });

    it("handles SDK failure gracefully", async () => {
      mockInitialize.mockRejectedValue(new Error("API Down"));

      const result = await initializePayment(validParams);

      expect(result.success).toBe(false);
      expect(result.message).toContain("API Down");
    });

    it("rejects negative amounts", async () => {
      const invalid = { ...validParams, amount: -10 };

      await expect(initializePayment(invalid)).rejects.toThrow();
    });
  });

  describe("verifyPayment", () => {
    it("converts minor units to major safely", async () => {
      mockVerify.mockResolvedValue({
        data: {
          status: "success",
          reference: "REF",
          amount: 25000,
          currency: "USD",
        },
      });

      const result = await verifyPayment("REF");

      expect(result.data.amount).toBe(250);
    });

    it("returns failure when status is not success", async () => {
      mockVerify.mockResolvedValue({
        data: { status: "failed", gateway_response: "Declined" },
      });

      const result = await verifyPayment("REF");

      expect(result.success).toBe(false);
    });
  });

  // REFERENCE GENERATION
  describe("generateReference", () => {
    it("is deterministic when Date mocked", () => {
      jest.spyOn(Date, "now").mockReturnValue(1700000000000);

      const ref = generateReference("ORD");

      expect(ref).toMatch(/^ORD-1700000000000-[A-Z0-9]+$/);

      Date.now.mockRestore();
    });

    it("generates unique values", () => {
      const refs = Array.from({ length: 20 }, () => generateReference());
      expect(new Set(refs).size).toBe(20);
    });
  });

  // WEBHOOK VALIDATION
  describe("validateWebhookSignature", () => {
    beforeEach(() => {
      process.env.PAYSTACK_SECRET_KEY = "test-secret";
    });

    it("accepts valid signature", () => {
      const payload = { event: "charge.success" };

      const hash = crypto
        .createHmac("sha512", "test-secret")
        .update(JSON.stringify(payload))
        .digest("hex");

      expect(validateWebhookSignature(hash, payload)).toBe(true);
    });

    it("rejects tampered payload", () => {
      const original = { event: "charge.success", amount: 100 };

      const hash = crypto
        .createHmac("sha512", "test-secret")
        .update(JSON.stringify(original))
        .digest("hex");

      const tampered = { event: "charge.success", amount: 200 };

      expect(validateWebhookSignature(hash, tampered)).toBe(false);
    });
  });
});
