const permissionRepository = require("../repositories/PermissionRepository");
const { getPermissionsForRole } = require("../policies/PermissionMatrix");

/**
 * Permission Service.
 * Resolves effective permissions for users across roles and employee grants.
 */
class PermissionService {
	async resolvePermissionsForUser(user) {
		if (!user || !user.id) {
			return [];
		}

		const employeeId = await permissionRepository.findEmployeeIdByUserId(user.id);
		if (employeeId) {
			return permissionRepository.getEmployeePermissions(employeeId);
		}

		return getPermissionsForRole(user.role);
	}

	async hasPermission(user, permission) {
		if (!user || !permission) {
			return false;
		}

		const permissions = await this.resolvePermissionsForUser(user);
		return permissions.includes(permission);
	}

	async hasAnyPermission(user, permissionList = []) {
		if (!user || !Array.isArray(permissionList) || permissionList.length === 0) {
			return false;
		}

		const permissions = await this.resolvePermissionsForUser(user);
		return permissionList.some((item) => permissions.includes(item));
	}

	async hasAllPermissions(user, permissionList = []) {
		if (!user || !Array.isArray(permissionList) || permissionList.length === 0) {
			return false;
		}

		const permissions = await this.resolvePermissionsForUser(user);
		return permissionList.every((item) => permissions.includes(item));
	}
}

module.exports = new PermissionService();
