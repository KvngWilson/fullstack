const express = require("express");
const { protect, permission } = require("../../../decorators");
const employeeControllers = require("../../../controllers/v1/admin/employees");
const adminPolicy = require("../../../../policies/adminPolicy");

const router = express.Router();

/**
 * Admin Employee Management Routes
 * All routes require authentication and explicit permission checks
 */

router.use(...protect());

// GET /api/v1/admin/employees - List employees
router.get(
  "/",
  ...permission(adminPolicy.employees.manage),
  employeeControllers.listEmployees
);

// POST /api/v1/admin/employees/invite - Send invitation
router.post(
  "/invite",
  ...permission(adminPolicy.employees.invite),
  employeeControllers.inviteEmployee
);

// GET /api/v1/admin/employees/:id - Get employee details
router.get(
  "/:id",
  ...permission(adminPolicy.employees.manage),
  employeeControllers.getEmployee
);

// PUT /api/v1/admin/employees/:id/role - Update role
router.put(
  "/:id/role",
  ...permission(adminPolicy.employees.manage),
  employeeControllers.updateEmployeeRole
);

// PUT /api/v1/admin/employees/:id/status - Update status
router.put(
  "/:id/status",
  ...permission(adminPolicy.employees.manage),
  employeeControllers.updateEmployeeStatus
);

module.exports = router;
