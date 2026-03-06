const { pool } = require("../../../config/db");

/**
 * Permission Repository.
 * Resolves employee and role-based permission grants from persistence.
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
		const result = await pool.query(
			`WITH role_perms AS (
				 SELECT DISTINCT
				 	COALESCE(
				 		NULLIF(TRIM(p.code), ''),
				 		CONCAT_WS(':', NULLIF(TRIM(p.resource), ''), NULLIF(TRIM(p.action), ''))
				 	) AS code
				 FROM employees e
				 JOIN roles r ON e.role_id = r.id
				 JOIN role_permissions rp ON r.id = rp.role_id
				 JOIN permissions p ON rp.permission_id = p.id
				 WHERE e.id = $1 AND r.is_active AND p.is_active
			 ),
			 override_perms AS (
				 SELECT DISTINCT
				 	COALESCE(
				 		NULLIF(TRIM(p.code), ''),
				 		CONCAT_WS(':', NULLIF(TRIM(p.resource), ''), NULLIF(TRIM(p.action), ''))
				 	) AS code
				 FROM employee_permission_overrides epo
				 JOIN permissions p ON epo.permission_id = p.id
				 WHERE epo.employee_id = $1
					 AND epo.grant_type = 'grant'
					 AND (epo.valid_until IS NULL OR epo.valid_until > now())
					 AND epo.valid_from <= now()
					 AND p.is_active
			 ),
			 revoked_perms AS (
				 SELECT DISTINCT
				 	COALESCE(
				 		NULLIF(TRIM(p.code), ''),
				 		CONCAT_WS(':', NULLIF(TRIM(p.resource), ''), NULLIF(TRIM(p.action), ''))
				 	) AS code
				 FROM employee_permission_overrides epo
				 JOIN permissions p ON epo.permission_id = p.id
				 WHERE epo.employee_id = $1
					 AND epo.grant_type = 'revoke'
					 AND (epo.valid_until IS NULL OR epo.valid_until > now())
			 )
			 SELECT DISTINCT code
			 FROM (SELECT code FROM role_perms UNION ALL SELECT code FROM override_perms) combined
			 WHERE code IS NOT NULL
			 	AND code NOT IN (SELECT code FROM revoked_perms WHERE code IS NOT NULL)
			 ORDER BY code`,
			[employeeId],
		);

		return result.rows.map((row) => row.code);
	}
}

module.exports = new PermissionRepository();
