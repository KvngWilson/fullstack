const request = require("supertest");
const jwt = require("jsonwebtoken");
const { createApp } = require("../../src/app");

const mockPaymentService = {
  createPayment: jest.fn(),
  verifyPaymentStatus: jest.fn(),
  getPaymentById: jest.fn(),
  getUserPayments: jest.fn(),
  handlePaymentCallback: jest.fn(),
  handleWebhook: jest.fn(),
};

jest.mock("../../domain/payment/services/PaymentService", () => {
  return jest.fn().mockImplementation(() => mockPaymentService);
});

const mockValidateWebhookSignature = jest.fn();
const mockConstructStripeEvent = jest.fn();

jest.mock("../../domain/payment/services/PaystackService", () => ({
  validateWebhookSignature: (...args) => mockValidateWebhookSignature(...args),
}));

jest.mock("../../domain/payment/services/StripeService", () => ({
  validateStripeWebhook: (...args) => mockConstructStripeEvent(...args),
}));

describe("Payment API - Integration Tests", () => {
  let app;
  let authToken;
  const userId = 9991;

  beforeAll(() => {
    app = createApp();

    authToken = jwt.sign(
      { id: userId, email: "payment@test.com", role: "customer" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/ordering/payments", () => {
    it("initializes payment successfully", async () => {
      mockPaymentService.createPayment.mockResolvedValue({
        payment_id: 123,
        authorization_url: "https://checkout.paystack.com/test123",
        access_code: "access123",
        reference: "PAY-123-ABC",
        amount: 150,
        currency: "USD",
        processor: "paystack",
      });

      const response = await request(app)
        .post("/api/v1/ordering/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          order_id: 5001,
          amount: 150.0,
          currency: "USD",
          processor: "paystack",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reference).toBe("PAY-123-ABC");
      expect(mockPaymentService.createPayment).toHaveBeenCalledWith(
        userId,
        5001,
        150,
        "USD",
        "paystack"
      );
    });

    it("validates required payload fields", async () => {
      const response = await request(app)
        .post("/api/v1/ordering/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("order_id and amount are required");
    });

    it("requires authentication", async () => {
      await request(app)
        .post("/api/v1/ordering/payments")
        .send({ order_id: 5001, amount: 150.0 })
        .expect(401);
    });

    it("maps service errors to API error response", async () => {
      mockPaymentService.createPayment.mockRejectedValue({
        status: 404,
        message: "Order not found",
      });

      const response = await request(app)
        .post("/api/v1/ordering/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ order_id: 99999, amount: 150.0 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Order not found");
    });
  });

  describe("GET /api/v1/ordering/payments", () => {
    it("lists user payments with metadata", async () => {
      mockPaymentService.getUserPayments.mockResolvedValue({
        payments: [{ id: 1, amount: "150.00", status: "pending" }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      });

      const response = await request(app)
        .get("/api/v1/ordering/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.payments)).toBe(true);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.page).toBe(1);
    });
  });

  describe("GET /api/v1/ordering/payments/:paymentId", () => {
    it("returns payment details for authorized user", async () => {
      mockPaymentService.getPaymentById.mockResolvedValue({
        id: 321,
        order_id: 5001,
        stripe_payment_id: "PAY-XYZ-321",
        amount: "150.00",
        status: "succeeded",
      });

      const response = await request(app)
        .get("/api/v1/ordering/payments/321")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(321);
      expect(response.body.data.status).toBe("succeeded");
    });
  });

  describe("GET /api/v1/ordering/payments/verify/:reference", () => {
    it("verifies payment successfully", async () => {
      mockPaymentService.verifyPaymentStatus.mockResolvedValue({
        payment_id: 321,
        order_id: 5001,
        reference: "PAY-VERIFY-123",
        status: "succeeded",
        verified: true,
        transaction_details: { status: "success" },
      });

      const response = await request(app)
        .get("/api/v1/ordering/payments/verify/PAY-VERIFY-123")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verified).toBe(true);
      expect(response.body.data.reference).toBe("PAY-VERIFY-123");
    });
  });

  describe("GET /api/v1/ordering/payments/callback", () => {
    it("redirects to order confirmation on successful callback", async () => {
      mockPaymentService.handlePaymentCallback.mockResolvedValue({
        success: true,
        orderId: 5001,
      });

      const response = await request(app)
        .get("/api/v1/ordering/payments/callback")
        .query({ reference: "PAY-CALLBACK-123" })
        .expect(302);

      expect(response.headers.location).toContain("/order-confirmation");
      expect(response.headers.location).toContain("order_id=5001");
      expect(response.headers.location).toContain("status=success");
    });

    it("redirects to checkout error when reference is missing", async () => {
      const response = await request(app)
        .get("/api/v1/ordering/payments/callback")
        .expect(302);

      expect(response.headers.location).toContain("/checkout");
      expect(response.headers.location).toContain("status=error");
    });
  });

  describe("POST /api/v1/ordering/payments/webhook", () => {
    it("rejects webhook with invalid signature", async () => {
      mockValidateWebhookSignature.mockReturnValue(false);

      const response = await request(app)
        .post("/api/v1/ordering/payments/webhook")
        .set("x-paystack-signature", "invalid-signature")
        .send({ event: "charge.success", data: {} })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid signature");
    });

    it("processes webhook with valid signature", async () => {
      mockValidateWebhookSignature.mockReturnValue(true);
      mockPaymentService.handleWebhook.mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/v1/ordering/payments/webhook")
        .set("x-paystack-signature", "valid-signature")
        .send({ event: "charge.success", data: { reference: "PAY-WEBHOOK-123" } })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe("success");
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(
        "charge.success",
        { reference: "PAY-WEBHOOK-123" },
        "paystack"
      );
    });
  });

  describe("POST /api/v1/ordering/payments/stripe-webhook", () => {
    it("returns 400 when stripe signature header is missing", async () => {
      await request(app)
        .post("/api/v1/ordering/payments/stripe-webhook")
        .send({ type: "checkout.session.completed", data: { object: {} } })
        .expect(400);
    });

    it("processes stripe webhook with valid signature", async () => {
      mockConstructStripeEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_123" } },
      });
      mockPaymentService.handleWebhook.mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/v1/ordering/payments/stripe-webhook")
        .set("stripe-signature", "valid-stripe-signature")
        .send({ any: "payload" })
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(
        "checkout.session.completed",
        { object: { id: "cs_test_123" } },
        "stripe"
      );
    });
  });
});
