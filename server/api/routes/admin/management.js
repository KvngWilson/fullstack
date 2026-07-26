const express = require("express");
const { protect, permission } = require("../../decorators");
const {
  getDashboardStats,
  getUsers,
  updateUserRole,
  deleteUser,
  getOrders,
  updateOrderStatus,
  getProductStats,
} = require("../../controllers/admin/admin");
const PERMISSIONS = require("../../../shared/constants/permissions");

const router = express.Router();

router.use(...protect());

router.get(
  "/dashboard/stats",
  ...permission(PERMISSIONS.ADMIN.DASHBOARD.READ),
  getDashboardStats,
);

router.get("/users", ...permission(PERMISSIONS.ADMIN.USERS.READ), getUsers);

router.patch(
  "/users/:id/role",
  ...permission(PERMISSIONS.ADMIN.USERS.UPDATE),
  updateUserRole,
);

router.delete(
  "/users/:id",
  ...permission(PERMISSIONS.ADMIN.USERS.DELETE),
  deleteUser,
);

router.get("/orders", ...permission(PERMISSIONS.ORDER.READ), getOrders);

router.patch(
  "/orders/:id/status",
  ...permission(PERMISSIONS.ORDER.UPDATE),
  updateOrderStatus,
);

router.get("/products/stats", ...permission(PERMISSIONS.PRODUCT.READ), getProductStats);

module.exports = router;
