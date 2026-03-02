const BaseRepository = require("../../shared/repositories/BaseRepository");
const { pool } = require("../../../config/db");

/**
 * Category Repository.
 * Handles category persistence operations with soft-delete semantics.
 */
class CategoryRepository extends BaseRepository {
  async findById(id) {
    const result = await pool.query(
      "SELECT id, name, description, created_at, updated_at FROM categories WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return result.rows[0] || null;
  }

  async findAll() {
    const result = await pool.query(
      `SELECT id, name, description, created_at, updated_at
       FROM categories
       WHERE deleted_at IS NULL
       ORDER BY name ASC`,
    );
    return result.rows;
  }

  async save(category) {
    if (category.id) {
      return this.update(category.id, category);
    }
    return this.create(category);
  }

  async create(data) {
    const result = await pool.query(
      `INSERT INTO categories (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at, updated_at`,
      [data.name, data.description ?? null],
    );
    return result.rows[0] || null;
  }

  async update(id, data) {
    const result = await pool.query(
      `UPDATE categories
       SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id, name, description, created_at, updated_at`,
      [data.name, data.description ?? null, id],
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await pool.query(
      `UPDATE categories
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id],
    );
    return result.rows[0] || null;
  }

  async findBySpec() {
    return this.findAll();
  }

  async count() {
    const result = await pool.query(
      "SELECT COUNT(*)::int AS count FROM categories WHERE deleted_at IS NULL",
    );
    return result.rows[0]?.count || 0;
  }

  async exists(id) {
    const result = await pool.query(
      "SELECT 1 FROM categories WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
      [id],
    );
    return result.rowCount > 0;
  }
}

module.exports = new CategoryRepository();
