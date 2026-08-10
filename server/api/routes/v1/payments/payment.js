const router = require("express").Router();
const { protect, admin, body } = require("../../../decorators");
const { idempotency } = require("../../../middleware/idempotency");
const { validateCreatePayment, validateCreateRefund } = require("../../../validators/payment");
const { payment } = require("../../../controllers/v1/payments");
const {
  createPayment,
  createRefund,
  processRefund,
  rejectRefund,
  verifyPaymentStatus,
  getPaymentById,
  getRefundById,
  listUserPayments,
  handlePaymentCallback,
  handleWebhook,
} = payment;

// Public routes (callback and webhook) - must be declared before dynamic :paymentId route
router.get("/callback", handlePaymentCallback);
router.post("/webhook", handleWebhook);

// Protected routes (require authentication)
router.post("/", ...protect(), idempotency(), ...body(validateCreatePayment), createPayment);
router.post("/refunds", ...protect(), idempotency(), ...body(validateCreateRefund), createRefund);
router.get("/", ...protect(), listUserPayments);
router.get("/refunds/:refundId", ...protect(), getRefundById);
router.post("/refunds/:refundId/process", ...admin(), processRefund);
router.post("/refunds/:refundId/reject", ...admin(), rejectRefund);
router.get("/verify/:reference", ...protect(), verifyPaymentStatus);
router.get("/:paymentId", ...protect(), getPaymentById);

module.exports = router;
