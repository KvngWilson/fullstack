const router = require("express").Router();
const { protect, permission, anyPermission } = require("../../decorators");

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
} = require("../../controllers/admin/admin");

// SSR Routes (Server-Side Rendered Views)
router.get("/", (req, res) => res.redirect("/dashboard"));

router.get(
  "/dashboard",
  ...protect(),
  ...permission("dashboard:view"),
  renderDashboard,
);

router.get(
  "/users",
  ...protect(),
  ...permission("user:read"),
  renderUsers,
);

router.post(
  "/users/:userId/role",
  ...protect(),
  ...permission("user:update"),
  postUserRoleUpdate,
);

router.post(
  "/users/:userId/delete",
  ...protect(),
  ...permission("user:delete"),
  postUserDelete,
);

router.get(
  "/orders",
  ...protect(),
  ...permission("order:read"),
  renderOrders,
);

router.get(
  "/categories",
  ...protect(),
  ...permission("product:update"),
  renderCategories,
);

router.get(
  "/transactions",
  ...protect(),
  ...permission("order:read"),
  renderTransactions,
);

router.get(
  "/products/add",
  ...protect(),
  ...permission("product:create"),
  renderAddProduct,
);

router.get(
  "/admin-role",
  ...protect(),
  ...permission("user:read"),
  renderAdminRole,
);

router.post(
  "/orders/:orderId/status",
  ...protect(),
  ...permission("order:update"),
  postOrderStatusUpdate,
);

// API Routes (RESTful JSON endpoints)
router.get(
  "/api/dashboard/stats",
  ...protect(),
  ...permission("dashboard:view"),
  getDashboardStats,
);

router.get(
  "/api/users",
  ...protect(),
  ...permission("user:read"),
  getUsers,
);

router.patch(
  "/api/users/:id/role",
  ...protect(),
  ...permission("user:update"),
  updateUserRole,
);

router.delete(
  "/api/users/:id",
  ...protect(),
  ...permission("user:delete"),
  deleteUser,
);

router.get(
  "/api/orders",
  ...protect(),
  ...permission("order:read"),
  getOrders,
);

router.patch(
  "/api/orders/:id/status",
  ...protect(),
  ...permission("order:update"),
  updateOrderStatus,
);

router.get(
  "/api/products/stats",
  ...protect(),
  ...permission("product:read"),
  getProductStats,
);

module.exports = router;
