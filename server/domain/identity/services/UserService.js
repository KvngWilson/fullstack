const userRepository = require("../repositories/UserRepository");

/**
 * User Service.
 * Provides read operations for user identity data.
 */
class UserService {
	async getById(id) {
		return userRepository.findById(id);
	}

	async getByEmail(email) {
		return userRepository.findByEmail(email);
	}
}

module.exports = new UserService();
