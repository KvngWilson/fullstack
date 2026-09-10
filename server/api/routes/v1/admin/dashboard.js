const express = require("express");
const { protect, permission } = require("../../../decorators");
const adminControllers = require("../../../controllers/admin/admin");
const PERMISSIONS = require("../../../../shared/constants/permissions");

const router = express.Router();

router.use(...protect());

router.get(
  "/",
  ...permission(PERMISSIONS.ADMIN.DASHBOARD.READ),
  adminControllers.getDashboardStats,
);

router.get(
  "/profile",
  ...permission(PERMISSIONS.ADMIN.DASHBOARD.READ),
  adminControllers.getAdminProfile,
);

module.exports = router;
