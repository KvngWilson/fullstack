const { pool } = require("../../../config/db");
const PermissionService = require("../../../shared/core/PermissionService");

/**
 * Permission Repository.
 * Resolves employee and role-based permission grants from persistence.
 * Note: Permission resolution logic is centralized in PermissionService to eliminate duplication.
 */
class PermissionRepository {
	async findEmployeeIdByUserId(userId) {
		const result = await pool.query(
			"SELECT id FROM employees WHERE user_id = $1 AND employment_status = 'active' LIMIT 1",
			[userId],
		);
		return result.rows[0]?.id || null;
	}

	async getEmployeePermissions(employeeId) {
		const permissions = await PermissionService.getEmployeePermissions(employeeId);
		return permissions.map((p) => p.code);
	}
}

module.exports = new PermissionRepository();
