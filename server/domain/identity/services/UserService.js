const userRepository = require("../repositories/UserRepository");
const BaseService = require("../../base/BaseService");
const adminPolicy = require("../../../policies/adminPolicy");

/**
 * User Service.
 * Provides read and write operations for user identity data.
 */
class UserService extends BaseService {
	constructor() {
		super();
	}

	async getById(id) {
		return userRepository.findById(id);
	}

	async getByEmail(email) {
		return userRepository.findByEmail(email);
	}

	async updateUser(userId, userData, employeeId = null) {
		// Permission validation for admin user updates
		if (employeeId) {
			await this.validatePermission(employeeId, adminPolicy.users.update);
		}

		const updatedUser = await userRepository.update(userId, userData);

		// Audit log
		if (employeeId) {
			await this.auditLog(
				employeeId,
				"user:update",
				"user",
				userId,
				{ changes: userData }
			);
		}

		return updatedUser;
	}

	async lockUser(userId, reason, employeeId = null) {
		// Permission validation
		if (employeeId) {
			await this.validatePermission(employeeId, adminPolicy.users.lock);
		}

		const updatedUser = await userRepository.update(userId, {
			is_locked: true,
			locked_reason: reason,
			locked_at: new Date(),
		});

		// Audit log
		if (employeeId) {
			await this.auditLog(employeeId, "user:lock", "user", userId, {
				reason,
			});
		}

		return updatedUser;
	}

	async unlockUser(userId, employeeId = null) {
		// Permission validation
		if (employeeId) {
			await this.validatePermission(employeeId, adminPolicy.users.unlock);
		}

		const updatedUser = await userRepository.update(userId, {
			is_locked: false,
			locked_reason: null,
			locked_at: null,
		});

		// Audit log
		if (employeeId) {
			await this.auditLog(employeeId, "user:unlock", "user", userId, {
				unlocked: true,
			});
		}

		return updatedUser;
	}
}

module.exports = new UserService();
