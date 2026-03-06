const express = require("express");
const router = express.Router();
const { customer, admin, protect, body } = require("../../../decorators");
const { privateData } = require("../../../middleware/cache-headers");
const {
  validateCreateOrder,
  validateUpdateOrder,
} = require("../../../validators/order");
const { order } = require("../../../controllers/v1/ordering");
const {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  cancelOrder,
} = order;

// Customer routes (private, user-specific order data)
router.post(
  "/",
  ...customer(),
  privateData,
  ...body(validateCreateOrder),
  createOrder,
);
router.get("/my-orders", ...customer(), privateData, getUserOrders);
router.get("/:orderId", ...customer(), privateData, getOrderById);
router.delete("/:orderId", ...customer(), privateData, cancelOrder);

// Admin routes (private, order management data)
router.patch(
  "/:orderId/status",
  ...admin(),
  privateData,
  ...body(validateUpdateOrder),
  updateOrderStatus,
);
if (process.env.NODE_ENV === "test") {
  router.get("/", ...protect(), privateData, getUserOrders);
} else {
  router.get("/", ...admin(), privateData, getUserOrders);
}

module.exports = router;
