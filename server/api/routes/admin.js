const router = require("express").Router();
const { requirePermission } = require("../middleware/authorization");
const { PERMISSIONS } = require("../../config/permissions");

const {
  renderDashboard,
  renderUsers,
  renderOrders,
  renderCategories,
  renderTransactions,
  renderAddProduct,
  renderAdminRole,
  postUserRoleUpdate,
  postUserDelete,
  postOrderStatusUpdate,
  getDashboardStats,
  getUsers,
  updateUserRole,
  deleteUser,
  getOrders,
  updateOrderStatus,
  getProductStats,
} = require("../controllers/admin");

// ==========================================
// SSR Routes (Server-Side Rendered Views)
// ==========================================

router.get("/", (req, res) => res.redirect("/dashboard"));

router.get(
  "/dashboard",
  // requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  renderDashboard,
);

router.get("/users", requirePermission(PERMISSIONS.USER_READ), renderUsers);

router.post(
  "/users/:userId/role",
  requirePermission(PERMISSIONS.USER_UPDATE),
  postUserRoleUpdate,
);

router.post(
  "/users/:userId/delete",
  requirePermission(PERMISSIONS.USER_DELETE),
  postUserDelete,
);

router.get("/orders", requirePermission(PERMISSIONS.ORDER_READ), renderOrders);

router.get(
  "/categories",
  requirePermission(PERMISSIONS.PRODUCT_UPDATE),
  renderCategories,
);

router.get(
  "/transactions",
  requirePermission(PERMISSIONS.ORDER_READ),
  renderTransactions,
);

router.get(
  "/products/add",
  requirePermission(PERMISSIONS.PRODUCT_CREATE),
  renderAddProduct,
);

router.get(
  "/admin-role",
  requirePermission(PERMISSIONS.USER_READ),
  renderAdminRole,
);

router.post(
  "/orders/:orderId/status",
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  postOrderStatusUpdate,
);

// ==========================================
// API Routes (RESTful JSON endpoints)
// ==========================================

router.get(
  "/api/dashboard/stats",
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  getDashboardStats,
);

router.get("/api/users", requirePermission(PERMISSIONS.USER_READ), getUsers);

router.patch(
  "/api/users/:id/role",
  requirePermission(PERMISSIONS.USER_UPDATE),
  updateUserRole,
);

router.delete(
  "/api/users/:id",
  requirePermission(PERMISSIONS.USER_DELETE),
  deleteUser,
);

router.get("/api/orders", requirePermission(PERMISSIONS.ORDER_READ), getOrders);

router.patch(
  "/api/orders/:id/status",
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  updateOrderStatus,
);

router.get(
  "/api/products/stats",
  requirePermission(PERMISSIONS.PRODUCT_READ),
  getProductStats,
);

module.exports = router;
