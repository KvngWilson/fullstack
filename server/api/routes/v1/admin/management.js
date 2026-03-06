const express = require("express");
const { protect, permission } = require("../../../decorators");
const {
  getDashboardStats,
  getUsers,
  updateUserRole,
  deleteUser,
  getOrders,
  updateOrderStatus,
  getProductStats,
} = require("../../../controllers/admin/admin");
const adminPolicy = require("../../../../policies/adminPolicy");
const orderPolicy = require("../../../../policies/orderPolicy");
const productPolicy = require("../../../../policies/productPolicy");

const router = express.Router();

router.use(...protect());

router.get(
  "/dashboard/stats",
  ...permission(adminPolicy.dashboard.read),
  getDashboardStats,
);

router.get(
  "/users",
  ...permission(adminPolicy.users.read),
  getUsers,
);

router.patch(
  "/users/:id/role",
  ...permission(adminPolicy.users.update),
  updateUserRole,
);

router.delete(
  "/users/:id",
  ...permission(adminPolicy.users.delete),
  deleteUser,
);

router.get(
  "/orders",
  ...permission(orderPolicy.read),
  getOrders,
);

router.patch(
  "/orders/:id/status",
  ...permission(orderPolicy.update),
  updateOrderStatus,
);

router.get(
  "/products/stats",
  ...permission(productPolicy.read),
  getProductStats,
);

module.exports = router;