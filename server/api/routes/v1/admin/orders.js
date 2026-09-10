const express = require("express");
const { protect, permission } = require("../../../decorators");
const adminControllers = require("../../../controllers/admin/admin");
const PERMISSIONS = require("../../../../shared/constants/permissions");

const router = express.Router();

router.use(...protect());

router.get("/", ...permission(PERMISSIONS.ORDER.READ), adminControllers.getOrders);

router.patch(
  "/:id/status",
  ...permission(PERMISSIONS.ORDER.UPDATE),
  adminControllers.updateOrderStatus,
);

module.exports = router;
