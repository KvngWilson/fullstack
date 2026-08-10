const router = require("express").Router();
const PERMISSIONS = require("../../../shared/constants/permissions");
const domain = require("../../../domain");
const { getAuthenticatedAdminUser } = require("../../controllers/admin/auth");
const permissionService = domain.identity.services.PermissionService;

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

function redirectToAdminLogin(req, res, errorMessage) {
  const params = new URLSearchParams();
  params.set("returnTo", req.originalUrl || "/dashboard");
  if (errorMessage) {
    params.set("error", errorMessage);
  }
  return res.redirect(`/auth/login?${params.toString()}`);
}

const protectedWithPermission = (requiredPermission) => async (req, res, next) => {
  try {
    const user = getAuthenticatedAdminUser(req);
    if (!user) {
      return redirectToAdminLogin(req, res);
    }

    req.user = user;

    if (!requiredPermission) {
      return next();
    }

    const allowed = await permissionService.hasPermission(user, requiredPermission);
    if (!allowed) {
      return redirectToAdminLogin(req, res, "Access denied");
    }

    return next();
  } catch (_error) {
    return redirectToAdminLogin(req, res, "Please sign in again");
  }
};

// SSR Routes (Server-Side Rendered Views)
router.get("/", (req, res) => res.redirect("/dashboard"));

router.get(
  "/dashboard",
  protectedWithPermission(PERMISSIONS.ADMIN.DASHBOARD.READ),
  renderDashboard,
);

router.get(
  "/users",
  protectedWithPermission(PERMISSIONS.ADMIN.USERS.READ),
  renderUsers,
);

router.post(
  "/users/:userId/role",
  protectedWithPermission(PERMISSIONS.ADMIN.USERS.UPDATE),
  postUserRoleUpdate,
);

router.post(
  "/users/:userId/delete",
  protectedWithPermission(PERMISSIONS.ADMIN.USERS.DELETE),
  postUserDelete,
);

router.get("/orders", protectedWithPermission(PERMISSIONS.ORDER.READ), renderOrders);

router.get(
  "/categories",
  protectedWithPermission(PERMISSIONS.PRODUCT.UPDATE),
  renderCategories,
);

router.get(
  "/transactions",
  protectedWithPermission(PERMISSIONS.ORDER.READ),
  renderTransactions,
);

router.get(
  "/products/add",
  protectedWithPermission(PERMISSIONS.PRODUCT.CREATE),
  renderAddProduct,
);

router.get(
  "/admin-role",
  protectedWithPermission(PERMISSIONS.ADMIN.USERS.READ),
  renderAdminRole,
);

router.post(
  "/orders/:orderId/status",
  protectedWithPermission(PERMISSIONS.ORDER.UPDATE),
  postOrderStatusUpdate,
);

module.exports = router;
