const { pool } = require("../../../config/db");

/**
 * Cart Service.
 * Handles cart lifecycle, item mutations, and cart totals.
 */
class CartService {
  async getOrCreateCart(userId) {
    const cartResult = await pool.query("SELECT id FROM carts WHERE user_id = $1", [
      userId,
    ]);

    if (cartResult.rows.length > 0) {
      return cartResult.rows[0].id;
    }

    const newCart = await pool.query(
      "INSERT INTO carts (user_id) VALUES ($1) RETURNING id",
      [userId],
    );

    return newCart.rows[0].id;
  }

  async getCartSnapshot(userId) {
    const cartId = await this.getOrCreateCart(userId);

    const items = await pool.query(
      `SELECT
        ci.id AS cart_item_id,
        ci.product_variant_id,
        ci.quantity,
        pv.sku,
        pv.price,
        pv.stock,
        pv.attributes,
        p.id AS product_id,
        p.name,
        p.description,
        (pv.price * ci.quantity) AS subtotal
       FROM cart_items ci
       JOIN product_variants pv ON ci.product_variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE ci.cart_id = $1
       ORDER BY ci.id DESC`,
      [cartId],
    );

    const total = items.rows.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const itemCount = items.rows.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    return {
      cart_id: cartId,
      items: items.rows,
      total: Number(total.toFixed(2)),
      item_count: itemCount,
    };
  }

  async getCartCount(userId) {
    const cartResult = await pool.query("SELECT id FROM carts WHERE user_id = $1", [
      userId,
    ]);

    if (!cartResult.rows.length) {
      return { count: 0 };
    }

    const countResult = await pool.query(
      "SELECT COALESCE(SUM(quantity), 0) AS count FROM cart_items WHERE cart_id = $1",
      [cartResult.rows[0].id],
    );

    return { count: Number.parseInt(countResult.rows[0].count, 10) };
  }

  async addToCart(userId, { product_variant_id, quantity = 1 }) {
    const variantId = Number.parseInt(product_variant_id, 10);
    const qty = Number.parseInt(quantity, 10);

    if (!Number.isInteger(variantId) || variantId <= 0) {
      const error = new Error("product_variant_id is required");
      error.status = 400;
      throw error;
    }

    if (!Number.isInteger(qty) || qty < 1) {
      const error = new Error("quantity must be a positive integer");
      error.status = 400;
      throw error;
    }

    const variantCheck = await pool.query(
      `SELECT id, stock
       FROM product_variants
       WHERE id = $1 AND deleted_at IS NULL`,
      [variantId],
    );

    if (!variantCheck.rows.length) {
      const error = new Error("Variant not found");
      error.status = 404;
      throw error;
    }

    const cartId = await this.getOrCreateCart(userId);

    const existing = await pool.query(
      `SELECT id, quantity
       FROM cart_items
       WHERE cart_id = $1 AND product_variant_id = $2`,
      [cartId, variantId],
    );

    const totalQuantity = existing.rows.length > 0 ? existing.rows[0].quantity + qty : qty;

    if (Number(variantCheck.rows[0].stock) < totalQuantity) {
      const error = new Error(
        `Insufficient stock. Only ${variantCheck.rows[0].stock} available, requested ${totalQuantity}`,
      );
      error.status = 400;
      throw error;
    }

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE cart_items
         SET quantity = quantity + $1
         WHERE id = $2
         RETURNING *`,
        [qty, existing.rows[0].id],
      );
    } else {
      result = await pool.query(
        `INSERT INTO cart_items (cart_id, product_variant_id, quantity)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [cartId, variantId, qty],
      );
    }

    return result.rows[0];
  }

  async updateCartItem(userId, itemId, quantity) {
    const qty = Number.parseInt(quantity, 10);

    if (!Number.isInteger(qty) || qty < 1) {
      const error = new Error("quantity must be greater than 0");
      error.status = 400;
      throw error;
    }

    const itemCheck = await pool.query(
      `SELECT ci.id, ci.product_variant_id, pv.stock
       FROM cart_items ci
       JOIN carts c ON ci.cart_id = c.id
       JOIN product_variants pv ON ci.product_variant_id = pv.id
       WHERE ci.id = $1 AND c.user_id = $2`,
      [itemId, userId],
    );

    if (!itemCheck.rows.length) {
      const error = new Error("Cart item not found");
      error.status = 404;
      throw error;
    }

    if (Number(itemCheck.rows[0].stock) < qty) {
      const error = new Error(
        `Insufficient stock. Only ${itemCheck.rows[0].stock} available, requested ${qty}`,
      );
      error.status = 400;
      throw error;
    }

    const result = await pool.query(
      `UPDATE cart_items ci
       SET quantity = $1
       FROM carts c
       WHERE ci.id = $2 AND ci.cart_id = c.id AND c.user_id = $3
       RETURNING ci.*`,
      [qty, itemId, userId],
    );

    return result.rows[0];
  }

  async deleteCartItem(userId, itemId) {
    const result = await pool.query(
      `DELETE FROM cart_items ci
       USING carts c
       WHERE ci.id = $1 AND ci.cart_id = c.id AND c.user_id = $2
       RETURNING ci.id`,
      [itemId, userId],
    );

    if (!result.rows.length) {
      const error = new Error("Cart item not found");
      error.status = 404;
      throw error;
    }

    return { id: result.rows[0].id };
  }

  async clearCart(userId) {
    const cartId = await this.getOrCreateCart(userId);
    await pool.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);

    return { cart_id: cartId, items: [], total: 0, item_count: 0 };
  }
}

module.exports = CartService;