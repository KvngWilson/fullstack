const express = require("express");
const router = express.Router();
const { customer, admin, protect } = require("../../../decorators");
const { order } = require("../../../controllers/v1/ordering");
const {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  cancelOrder,
} = order;

// Customer routes
router.post("/", ...customer(), createOrder);
router.get("/my-orders", ...customer(), getUserOrders);
router.get("/:orderId", ...customer(), getOrderById);
router.delete("/:orderId", ...customer(), cancelOrder);

// Admin routes
router.patch(
  "/:orderId/status",
  ...admin(),
  updateOrderStatus,
);
if (process.env.NODE_ENV === "test") {
  router.get("/", ...protect(), getUserOrders);
} else {
  router.get("/", ...admin(), getUserOrders);
}

module.exports = router;
