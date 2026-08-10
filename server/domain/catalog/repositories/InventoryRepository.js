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

  /**
   * Reserve stock using optimistic locking.
   * Reads the row's version, then decrements stock only if the version is
   * unchanged. A concurrent writer bumps the version, making the UPDATE
   * match zero rows; we re-read and retry up to maxRetries times.
   *
   * @param {Object} executor - pg client (pass the transaction client during checkout)
   * @param {Object} params - { variantId, quantity }
   * @param {Object} [options] - { maxRetries }
   * @returns {Promise<{reserved: boolean, reason?: string, variant?: Object}>}
   *   reason is one of 'not_found' | 'insufficient_stock' | 'version_conflict'
   */
  async reserveStockWithOptimisticLock(
    executor,
    { variantId, quantity },
    { maxRetries = 3 } = {},
  ) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const current = await executor.query(
        `SELECT id, stock, version
         FROM product_variants
         WHERE id = $1 AND deleted_at IS NULL`,
        [variantId],
      );

      if (current.rows.length === 0) {
        return { reserved: false, reason: "not_found" };
      }

      const { stock, version } = current.rows[0];
      if (stock < quantity) {
        return { reserved: false, reason: "insufficient_stock" };
      }

      const result = await executor.query(
        `UPDATE product_variants
         SET stock = stock - $1, version = version + 1, updated_at = NOW()
         WHERE id = $2 AND version = $3 AND stock >= $1 AND deleted_at IS NULL
         RETURNING id, stock, version`,
        [quantity, variantId, version],
      );

      if (result.rows.length > 0) {
        return { reserved: true, variant: result.rows[0] };
      }
      // Version changed under us — loop to re-read and retry
    }

    return { reserved: false, reason: "version_conflict" };
  }

  /**
   * Return previously reserved stock (order cancellation, payment failure).
   * Bumps the version so concurrent optimistic readers retry.
   */
  async releaseStock(executor, { variantId, quantity }) {
    const result = await executor.query(
      `UPDATE product_variants
       SET stock = stock + $1, version = version + 1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, stock, version`,
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
