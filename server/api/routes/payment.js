const router = require('express').Router();
const {
  createPayment,
  verifyPaymentStatus,
  getPaymentById,
  listUserPayments,
  handlePaymentCallback,
  handleWebhook,
} = require('../controllers/payment');
const { authenticateJWT } = require('../../config/auth');

// Public routes (callback and webhook) - must be declared before dynamic :paymentId route
router.get('/callback', handlePaymentCallback);
router.post('/webhook', handleWebhook);

// Protected routes (require authentication)
router.post('/', authenticateJWT, createPayment);
router.get('/', authenticateJWT, listUserPayments);
router.get('/verify/:reference', authenticateJWT, verifyPaymentStatus);
router.get('/:paymentId', authenticateJWT, getPaymentById);

module.exports = router;
