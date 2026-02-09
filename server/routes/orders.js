const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../config/auth');
const { requireCustomer, requireAdmin } = require('../middleware/authorization');
const {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  cancelOrder,
} = require('../controllers/orders');

// Customer routes
router.post('/', authenticateJWT, requireCustomer, createOrder);
router.get('/my-orders', authenticateJWT, requireCustomer, getUserOrders);
router.get('/:orderId', authenticateJWT, requireCustomer, getOrderById); // Now has authorization check in controller
router.post('/:orderId/cancel', authenticateJWT, requireCustomer, cancelOrder);

// Admin routes
router.patch('/:orderId/status', authenticateJWT, requireAdmin, updateOrderStatus);
router.get('/', authenticateJWT, requireAdmin, getUserOrders); // Admin sees all orders

module.exports = router;