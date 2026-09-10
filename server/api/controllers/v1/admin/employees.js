const { logger } = require("../../../../shared/utils/logger");
const EmployeeManagementService = require("../../../../services/employeeManagement");

/**
 * Admin Employees Controllers
 * Endpoints:
 * - GET /api/v1/admin/employees - List all employees
 * - POST /api/v1/admin/employees/invite - Send employee invitation
 * - GET /api/v1/admin/employees/:id - Get employee details
 * - PUT /api/v1/admin/employees/:id - Update employee
 * - PUT /api/v1/admin/employees/:id/role - Update employee role
 * - PUT /api/v1/admin/employees/:id/status - Suspend/activate employee
 * - DELETE /api/v1/admin/employees/:id - Delete employee
 */

// GET /api/v1/admin/employees
// List all employees with filtering
exports.listEmployees = async (req, res) => {
  try {
    const result = await EmployeeManagementService.listEmployeesForAdmin(
      req.query,
    );

    res.json({
      employees: result.employees,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (error) {
    logger.error("List employees error", { error: error.message });
    res.status(EmployeeManagementService.getErrorStatus(error)).json({
      error: error.message,
    });
  }
};

// POST /api/v1/admin/employees/invite
// Send employee invitation via email
exports.inviteEmployee = async (req, res) => {
  try {
    const { email, roleCode } = req.body;
    const invitation = await EmployeeManagementService.inviteEmployee({
      email,
      roleCode,
      invitedByUserId: req.user.id,
      expiryHours: 24 * 7,
    });

    res.status(201).json({
      message: "Invitation sent",
      inviteId: invitation.id,
      email: invitation.email,
    });
  } catch (error) {
    logger.error("Invite employee error", { error: error.message });
    res.status(EmployeeManagementService.getErrorStatus(error)).json({
      error: error.message,
    });
  }
};

// GET /api/v1/admin/employees/:id
// Get employee details
exports.getEmployee = async (req, res) => {
  try {
    const employee = await EmployeeManagementService.getEmployeeDetailsForAdmin(
      req.params.id,
    );

    res.json(employee);
  } catch (error) {
    logger.error("Get employee error", { error: error.message });
    res.status(EmployeeManagementService.getErrorStatus(error)).json({
      error: error.message,
    });
  }
};

// PUT /api/v1/admin/employees/:id/role
// Update employee role
exports.updateEmployeeRole = async (req, res) => {
  try {
    await EmployeeManagementService.updateEmployeeRole({
      employeeId: req.params.id,
      roleCode: req.body.roleCode,
      actorEmployeeId: req.employee.id,
      actorUserId: req.user.id,
      enforceHierarchy: true,
    });

    res.json({ message: "Employee role updated", employeeId: req.params.id });
  } catch (error) {
    logger.error("Update employee role error", { error: error.message });
    res.status(EmployeeManagementService.getErrorStatus(error)).json({
      error: error.message,
    });
  }
};

// PUT /api/v1/admin/employees/:id/status
// Suspend or activate employee
exports.updateEmployeeStatus = async (req, res) => {
  try {
    await EmployeeManagementService.updateEmployeeStatus({
      employeeId: req.params.id,
      status: req.body.status,
      actorEmployeeId: req.employee.id,
      actorUserId: req.user.id,
      allowedStatuses: ["active", "suspended", "on_leave", "terminated"],
    });

    res.json({ message: "Employee status updated", employeeId: req.params.id });
  } catch (error) {
    logger.error("Update employee status error", { error: error.message });
    res.status(EmployeeManagementService.getErrorStatus(error)).json({
      error: error.message,
    });
  }
};
