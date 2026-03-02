const BaseRepository = require("../../shared/repositories/BaseRepository");
const { pool } = require("../../../config/db");

/**
 * Inventory Repository.
 * Handles stock and variant inventory persistence operations.
 */
class InventoryRepository extends BaseRepository {
  async findById(variantId) {
    const result = await pool.query(
      "SELECT id, product_id, sku, stock, reserved_stock, price FROM product_variants WHERE id = $1 AND deleted_at IS NULL",
      [variantId],
    );
    return result.rows[0] || null;
  }

  async findAll() {
    const result = await pool.query(
      "SELECT id, product_id, sku, stock, reserved_stock, price FROM product_variants WHERE deleted_at IS NULL",
    );
    return result.rows;
  }

  async findByProductId(productId) {
    const result = await pool.query(
      "SELECT id, product_id, sku, stock, reserved_stock, price FROM product_variants WHERE product_id = $1 AND deleted_at IS NULL",
      [productId],
    );
    return result.rows;
  }

  async updateStock(variantId, newStock) {
    const result = await pool.query(
      `UPDATE product_variants
       SET stock = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, product_id, sku, stock`,
      [newStock, variantId],
    );
    return result.rows[0] || null;
  }

  async decrementStock(variantId, quantity) {
    const result = await pool.query(
      `UPDATE product_variants
       SET stock = stock - $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL AND stock >= $1
       RETURNING id, product_id, sku, stock`,
      [quantity, variantId],
    );
    return result.rows[0] || null;
  }

  async save(variant) {
    throw new Error("InventoryRepository.save() not implemented");
  }

  async delete(id) {
    throw new Error("InventoryRepository.delete() not implemented");
  }

  async findBySpec() {
    return this.findAll();
  }

  async count() {
    const result = await pool.query(
      "SELECT COUNT(*)::int AS count FROM product_variants WHERE deleted_at IS NULL",
    );
    return result.rows[0]?.count || 0;
  }

  async exists(id) {
    const result = await pool.query(
      "SELECT 1 FROM product_variants WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
      [id],
    );
    return result.rowCount > 0;
  }
}

module.exports = new InventoryRepository();
