const express = require("express");
const { protect, permission } = require("../../../decorators");
const adminControllers = require("../../../controllers/admin/admin");
const PERMISSIONS = require("../../../../shared/constants/permissions");

const router = express.Router();

router.use(...protect());

router.get(
  "/",
  ...permission(PERMISSIONS.ADMIN.USERS.READ),
  adminControllers.getUsers,
);

router.patch(
  "/:id/role",
  ...permission(PERMISSIONS.ADMIN.USERS.UPDATE),
  adminControllers.updateUserRole,
);

router.delete(
  "/:id",
  ...permission(PERMISSIONS.ADMIN.USERS.DELETE),
  adminControllers.deleteUser,
);

module.exports = router;
