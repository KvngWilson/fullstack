const argon2 = require("argon2");
const BaseRepository = require("../../shared/repositories/BaseRepository");
const { pool } = require("../../../config/db");

/**
 * User Repository
 * Handles all database operations for user aggregates
 * Includes password hashing and authentication queries
 */
class UserRepository extends BaseRepository {
	async findById(id) {
		const result = await pool.query(
			`SELECT id, email, role, is_active, deleted_at, created_at, last_login
			 FROM users
			 WHERE id = $1
			 LIMIT 1`,
			[id],
		);
		return result.rows[0] || null;
	}

	async findByEmail(email) {
		const result = await pool.query(
			`SELECT id, email, role, password_hash, is_active, deleted_at, created_at, last_login
			 FROM users
			 WHERE email = $1
			 LIMIT 1`,
			[email],
		);
		return result.rows[0] || null;
	}

	async createCustomer({ email, password }) {
		const passwordHash = await argon2.hash(password);
		const result = await pool.query(
			`INSERT INTO users (email, password_hash, role)
			 VALUES ($1, $2, $3)
			 RETURNING id, email, role, is_active, deleted_at, created_at, last_login`,
			[email, passwordHash, "customer"],
		);
		// Hash password using argon2 and create new customer user
		return result.rows[0] || null;
	}

	async updateLastLogin(id) {
		await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [id]);
	}

	async save(aggregate) {
		return aggregate;
	}

	async findAll() {
		return [];
	}

	async delete(id) {
		const result = await pool.query("UPDATE users SET deleted_at = NOW() WHERE id = $1", [id]);
		return result.rowCount > 0;
	}

	async findBySpec() {
		return [];
	}

	async count() {
		const result = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE deleted_at IS NULL");
		return result.rows[0]?.count || 0;
	}

	async exists(id) {
		const result = await pool.query("SELECT 1 FROM users WHERE id = $1 LIMIT 1", [id]);
		return result.rowCount > 0;
	}
}

module.exports = new UserRepository();
