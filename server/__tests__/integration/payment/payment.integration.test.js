const request = require("supertest");
const jwt = require("jsonwebtoken");
const { pool } = require("../../../config/db");
const { createDbInfraGuard } = require("../../helpers/testHelpers");

var mockPaymentService = {
  createPayment: jest.fn(),
  verifyPaymentStatus: jest.fn(),
  getPaymentById: jest.fn(),
  getUserPayments: jest.fn(),
  handlePaymentCallback: jest.fn(),
  handleWebhook: jest.fn(),
};

var mockRefundService = {
  createRefund: jest.fn(),
  getRefundById: jest.fn(),
  processRefund: jest.fn(),
  rejectRefund: jest.fn(),
};

jest.mock("../../../domain/payment/services/PaymentService", () => {
  return jest.fn().mockImplementation(() => mockPaymentService);
});

jest.mock("../../../domain/payment/services/RefundService", () => {
  return jest.fn().mockImplementation(() => mockRefundService);
});

const { createApp } = require("../../../src/app");

const mockValidateWebhookSignature = jest.fn();
const mockConstructStripeEvent = jest.fn();

jest.mock("../../../domain/payment/services/PaystackService", () => ({
  validateWebhookSignature: (...args) => mockValidateWebhookSignature(...args),
}));

jest.mock("../../../domain/payment/services/StripeService", () => ({
  validateStripeWebhook: (...args) => mockConstructStripeEvent(...args),
}));

describe("Payment API - Integration Tests", () => {
  let app;
  let authToken;
  let adminToken;
  let userId;
  const PAYMENT_TEST_EMAIL = `payment-${Date.now()}@integration.test`;
  const { disable, isReady, dbTest } = createDbInfraGuard();

  beforeAll(async () => {
    app = createApp();

    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    try {
      const userResult = await pool.query(
        "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
        [PAYMENT_TEST_EMAIL, "$argon2id$test", "customer"],
      );
      userId = userResult.rows[0].id;

      authToken = jwt.sign(
        { id: userId, email: PAYMENT_TEST_EMAIL, role: "customer" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "24h" },
      );

      adminToken = jwt.sign(
        { id: 9999, email: "admin@integration.test", role: "admin" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "24h" },
      );
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;
    await pool.query("DELETE FROM users WHERE email = $1", [
      PAYMENT_TEST_EMAIL,
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/payments", () => {
    dbTest("initializes payment successfully", async () => {
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
        .post("/api/v1/payments")
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
        "paystack",
      );
    });

    dbTest("validates required payload fields", async () => {
      const response = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message || response.body.error).toContain(
        "order_id",
      );
    });

    dbTest("requires authentication", async () => {
      await request(app)
        .post("/api/v1/payments")
        .send({ order_id: 5001, amount: 150.0 })
        .expect(401);
    });

    dbTest("maps service errors to API error response", async () => {
      mockPaymentService.createPayment.mockRejectedValue({
        status: 404,
        message: "Order not found",
      });

      const response = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ order_id: 99999, amount: 150.0 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Order not found");
    });
  });

  describe("GET /api/v1/payments", () => {
    dbTest("lists user payments with metadata", async () => {
      mockPaymentService.getUserPayments.mockResolvedValue({
        payments: [{ id: 1, amount: "150.00", status: "pending" }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      });

      const response = await request(app)
        .get("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.payments)).toBe(true);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.page).toBe(1);
    });
  });

  describe("GET /api/v1/payments/:paymentId", () => {
    dbTest("returns payment details for authorized user", async () => {
      mockPaymentService.getPaymentById.mockResolvedValue({
        id: 321,
        order_id: 5001,
        stripe_payment_id: "PAY-XYZ-321",
        amount: "150.00",
        status: "succeeded",
      });

      const response = await request(app)
        .get("/api/v1/payments/321")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(321);
      expect(response.body.data.status).toBe("succeeded");
    });
  });

  describe("POST /api/v1/payments/refunds", () => {
    dbTest("creates refund successfully", async () => {
      mockRefundService.createRefund.mockResolvedValue({
        refund_id: 901,
        payment_id: 321,
        amount: 50,
        reason: "customer_request",
        status: "pending",
      });

      const response = await request(app)
        .post("/api/v1/payments/refunds")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          payment_id: 321,
          amount: 50,
          reason: "customer_request",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.refund_id).toBe(901);
      expect(mockRefundService.createRefund).toHaveBeenCalledWith(
        321,
        userId,
        50,
        "customer_request",
      );
    });

    dbTest("validates refund payload", async () => {
      await request(app)
        .post("/api/v1/payments/refunds")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ payment_id: 321 })
        .expect(400);
    });
  });

  describe("GET /api/v1/payments/refunds/:refundId", () => {
    dbTest("returns refund details", async () => {
      mockRefundService.getRefundById.mockResolvedValue({
        id: 901,
        payment_id: 321,
        amount: "50.00",
        status: "pending",
      });

      const response = await request(app)
        .get("/api/v1/payments/refunds/901")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(901);
      expect(mockRefundService.getRefundById).toHaveBeenCalledWith("901", userId);
    });
  });

  describe("POST /api/v1/payments/refunds/:refundId/process", () => {
    dbTest("processes refund as admin", async () => {
      mockRefundService.processRefund.mockResolvedValue({
        refund_id: 901,
        payment_id: 321,
        amount: 50,
        status: "completed",
      });

      const response = await request(app)
        .post("/api/v1/payments/refunds/901/process")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("completed");
      expect(mockRefundService.processRefund).toHaveBeenCalledWith("901", 9999, true);
    });
  });

  describe("POST /api/v1/payments/refunds/:refundId/reject", () => {
    dbTest("rejects refund as admin", async () => {
      mockRefundService.rejectRefund.mockResolvedValue({
        refund_id: 901,
        payment_id: 321,
        status: "rejected",
        rejection_reason: "Invalid request",
      });

      const response = await request(app)
        .post("/api/v1/payments/refunds/901/reject")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Invalid request" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("rejected");
      expect(mockRefundService.rejectRefund).toHaveBeenCalledWith(
        "901",
        9999,
        "Invalid request",
        true,
      );
    });
  });

  describe("GET /api/v1/payments/verify/:reference", () => {
    dbTest("verifies payment successfully", async () => {
      mockPaymentService.verifyPaymentStatus.mockResolvedValue({
        payment_id: 321,
        order_id: 5001,
        reference: "PAY-VERIFY-123",
        status: "succeeded",
        verified: true,
        transaction_details: { status: "success" },
      });

      const response = await request(app)
        .get("/api/v1/payments/verify/PAY-VERIFY-123")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verified).toBe(true);
      expect(response.body.data.reference).toBe("PAY-VERIFY-123");
    });
  });

  describe("GET /api/v1/payments/callback", () => {
    dbTest("redirects to order confirmation on successful callback", async () => {
      mockPaymentService.handlePaymentCallback.mockResolvedValue({
        success: true,
        orderId: 5001,
      });

      const response = await request(app)
        .get("/api/v1/payments/callback")
        .query({ reference: "PAY-CALLBACK-123" })
        .expect(302);

      expect(response.headers.location).toContain("/order-confirmation");
      expect(response.headers.location).toContain("order_id=5001");
      expect(response.headers.location).toContain("status=success");
    });

    dbTest("redirects to checkout error when reference is missing", async () => {
      const response = await request(app)
        .get("/api/v1/payments/callback")
        .expect(302);

      expect(response.headers.location).toContain("/checkout");
      expect(response.headers.location).toContain("status=error");
    });
  });

  describe("POST /api/v1/payments/webhook", () => {
    dbTest("rejects webhook with invalid signature", async () => {
      mockValidateWebhookSignature.mockReturnValue(false);

      const response = await request(app)
        .post("/api/v1/payments/webhook")
        .set("x-paystack-signature", "invalid-signature")
        .send({ event: "charge.success", data: {} })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid signature");
    });

    dbTest("processes webhook with valid signature", async () => {
      mockValidateWebhookSignature.mockReturnValue(true);
      mockPaymentService.handleWebhook.mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/v1/payments/webhook")
        .set("x-paystack-signature", "valid-signature")
        .send({
          event: "charge.success",
          data: { reference: "PAY-WEBHOOK-123" },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe("accepted");
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(
        "charge.success",
        { reference: "PAY-WEBHOOK-123" },
        "paystack",
      );
    });
  });

  describe("POST /api/v1/payments/stripe-webhook", () => {
    dbTest("returns 400 when stripe signature header is missing", async () => {
      await request(app)
        .post("/api/v1/payments/stripe-webhook")
        .send({ type: "checkout.session.completed", data: { object: {} } })
        .expect(400);
    });

    dbTest("processes stripe webhook with valid signature", async () => {
      mockConstructStripeEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_123" } },
      });
      mockPaymentService.handleWebhook.mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/v1/payments/stripe-webhook")
        .set("stripe-signature", "valid-stripe-signature")
        .send({ any: "payload" })
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(
        "checkout.session.completed",
        { object: { id: "cs_test_123" } },
        "stripe",
      );
    });
  });
});
