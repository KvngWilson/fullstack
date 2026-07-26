const express = require("express");
const { protect, permission } = require("../../../decorators");
const employeeControllers = require("../../../controllers/v1/admin/employees");
const PERMISSIONS = require("../../../../shared/constants/permissions");

const router = express.Router();

/**
 * Admin Employee Management Routes
 * All routes require authentication and explicit permission checks
 */

router.use(...protect());

// GET /api/v1/admin/employees - List employees
router.get(
  "/",
  ...permission(PERMISSIONS.EMPLOYEE.MANAGE),
  employeeControllers.listEmployees
);

// POST /api/v1/admin/employees/invite - Send invitation
router.post(
  "/invite",
  ...permission(PERMISSIONS.EMPLOYEE.INVITE),
  employeeControllers.inviteEmployee
);

// GET /api/v1/admin/employees/:id - Get employee details
router.get(
  "/:id",
  ...permission(PERMISSIONS.EMPLOYEE.MANAGE),
  employeeControllers.getEmployee
);

// PUT /api/v1/admin/employees/:id/role - Update role
router.put(
  "/:id/role",
  ...permission(PERMISSIONS.EMPLOYEE.MANAGE),
  employeeControllers.updateEmployeeRole
);

// PUT /api/v1/admin/employees/:id/status - Update status
router.put(
  "/:id/status",
  ...permission(PERMISSIONS.EMPLOYEE.MANAGE),
  employeeControllers.updateEmployeeStatus
);

module.exports = router;
