const router = require('express').Router();
const { protect } = require('../../../decorators');
const { payment } = require('../../../controllers/v1/payments');
const {
  createPayment,
  verifyPaymentStatus,
  getPaymentById,
  listUserPayments,
  handlePaymentCallback,
  handleWebhook,
  handleStripeWebhook,
} = payment;

// Public routes (callback and webhook) - must be declared before dynamic :paymentId route
router.get('/callback', handlePaymentCallback);
router.post('/webhook', handleWebhook);
router.post('/stripe-webhook', handleStripeWebhook);

// Protected routes (require authentication)
router.post('/', ...protect(), createPayment);
router.get('/', ...protect(), listUserPayments);
router.get('/verify/:reference', ...protect(), verifyPaymentStatus);
router.get('/:paymentId', ...protect(), getPaymentById);

module.exports = router;
