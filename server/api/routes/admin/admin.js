const router = require("express").Router();
const { protect, permission } = require("../../decorators");
const adminPolicy = require("../../../policies/adminPolicy");
const orderPolicy = require("../../../policies/orderPolicy");
const productPolicy = require("../../../policies/productPolicy");

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
} = require("../../controllers/admin/admin");

// SSR Routes (Server-Side Rendered Views)
router.get("/", (req, res) => res.redirect("/dashboard"));

router.get(
  "/dashboard",
  ...protect(),
  ...permission(adminPolicy.dashboard.read),
  renderDashboard,
);

router.get("/users", ...protect(), ...permission(adminPolicy.users.read), renderUsers);

router.post(
  "/users/:userId/role",
  ...protect(),
  ...permission(adminPolicy.users.update),
  postUserRoleUpdate,
);

router.post(
  "/users/:userId/delete",
  ...protect(),
  ...permission(adminPolicy.users.delete),
  postUserDelete,
);

router.get("/orders", ...protect(), ...permission(orderPolicy.read), renderOrders);

router.get(
  "/categories",
  ...protect(),
  ...permission(productPolicy.update),
  renderCategories,
);

router.get(
  "/transactions",
  ...protect(),
  ...permission(orderPolicy.read),
  renderTransactions,
);

router.get(
  "/products/add",
  ...protect(),
  ...permission(productPolicy.create),
  renderAddProduct,
);

router.get(
  "/admin-role",
  ...protect(),
  ...permission(adminPolicy.users.read),
  renderAdminRole,
);

router.post(
  "/orders/:orderId/status",
  ...protect(),
  ...permission(orderPolicy.update),
  postOrderStatusUpdate,
);

module.exports = router;
