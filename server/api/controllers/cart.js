const { pool } = require("../../config/db");
const { successResponse, errorResponse } = require("../../utils/response");
const logger = require("../../utils/logger");

const getOrCreateCart = async (userId) => {
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
};

const getCartSnapshot = async (userId) => {
  const cartId = await getOrCreateCart(userId);

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
};

exports.getCartItems = async (req, res) => {
  try {
    const payload = await getCartSnapshot(req.user.id);
    return successResponse(res, { data: payload });
  } catch (error) {
    logger.error("Get cart error", { error, userId: req.user.id });
    return errorResponse(res, { message: "Failed to fetch cart", status: 500 });
  }
};

exports.getCartCount = async (req, res) => {
  try {
    const cartResult = await pool.query("SELECT id FROM carts WHERE user_id = $1", [
      req.user.id,
    ]);

    if (!cartResult.rows.length) {
      return successResponse(res, { data: { count: 0 } });
    }

    const countResult = await pool.query(
      "SELECT COALESCE(SUM(quantity), 0) AS count FROM cart_items WHERE cart_id = $1",
      [cartResult.rows[0].id],
    );

    return successResponse(res, {
      data: { count: Number.parseInt(countResult.rows[0].count, 10) },
    });
  } catch (error) {
    logger.error("Get cart count error", { error, userId: req.user.id });
    return errorResponse(res, { message: "Failed to fetch cart count", status: 500 });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { product_variant_id, quantity = 1 } = req.body;

    const variantId = Number.parseInt(product_variant_id, 10);
    const qty = Number.parseInt(quantity, 10);

    if (!Number.isInteger(variantId) || variantId <= 0) {
      return errorResponse(res, {
        message: "product_variant_id is required",
        status: 400,
      });
    }

    if (!Number.isInteger(qty) || qty < 1) {
      return errorResponse(res, {
        message: "quantity must be a positive integer",
        status: 400,
      });
    }

    const variantCheck = await pool.query(
      `SELECT id, stock
       FROM product_variants
       WHERE id = $1 AND deleted_at IS NULL`,
      [variantId],
    );

    if (!variantCheck.rows.length) {
      return errorResponse(res, { message: "Variant not found", status: 404 });
    }

    const cartId = await getOrCreateCart(req.user.id);

    const existing = await pool.query(
      `SELECT id, quantity
       FROM cart_items
       WHERE cart_id = $1 AND product_variant_id = $2`,
      [cartId, variantId],
    );

    const totalQuantity = existing.rows.length > 0 ? existing.rows[0].quantity + qty : qty;

    if (Number(variantCheck.rows[0].stock) < totalQuantity) {
      return errorResponse(res, {
        message: `Insufficient stock. Only ${variantCheck.rows[0].stock} available, requested ${totalQuantity}`,
        status: 400,
      });
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

    return successResponse(res, {
      status: 201,
      message: "Item added to cart",
      data: result.rows[0],
    });
  } catch (error) {
    logger.error("Add to cart error", { error, userId: req.user.id });
    return errorResponse(res, { message: "Failed to add item to cart", status: 500 });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const qty = Number.parseInt(req.body.quantity, 10);

    if (!Number.isInteger(qty) || qty < 1) {
      return errorResponse(res, { message: "quantity must be greater than 0", status: 400 });
    }

    const itemCheck = await pool.query(
      `SELECT ci.id, ci.product_variant_id, pv.stock
       FROM cart_items ci
       JOIN carts c ON ci.cart_id = c.id
       JOIN product_variants pv ON ci.product_variant_id = pv.id
       WHERE ci.id = $1 AND c.user_id = $2`,
      [itemId, req.user.id],
    );

    if (!itemCheck.rows.length) {
      return errorResponse(res, { message: "Cart item not found", status: 404 });
    }

    if (Number(itemCheck.rows[0].stock) < qty) {
      return errorResponse(res, {
        message: `Insufficient stock. Only ${itemCheck.rows[0].stock} available, requested ${qty}`,
        status: 400,
      });
    }

    const result = await pool.query(
      `UPDATE cart_items ci
       SET quantity = $1
       FROM carts c
       WHERE ci.id = $2 AND ci.cart_id = c.id AND c.user_id = $3
       RETURNING ci.*`,
      [qty, itemId, req.user.id],
    );

    return successResponse(res, {
      message: "Cart item updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    logger.error("Update cart item error", { error, userId: req.user.id });
    return errorResponse(res, { message: "Failed to update cart item", status: 500 });
  }
};

exports.deleteCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const result = await pool.query(
      `DELETE FROM cart_items ci
       USING carts c
       WHERE ci.id = $1 AND ci.cart_id = c.id AND c.user_id = $2
       RETURNING ci.id`,
      [itemId, req.user.id],
    );

    if (!result.rows.length) {
      return errorResponse(res, { message: "Cart item not found", status: 404 });
    }

    return successResponse(res, {
      message: "Cart item removed successfully",
      data: null,
    });
  } catch (error) {
    logger.error("Remove cart item error", { error, userId: req.user.id });
    return errorResponse(res, { message: "Failed to remove cart item", status: 500 });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const cartId = await getOrCreateCart(req.user.id);
    await pool.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);

    return successResponse(res, {
      message: "Cart cleared successfully",
      data: { cart_id: cartId, items: [], total: 0, item_count: 0 },
    });
  } catch (error) {
    logger.error("Clear cart error", { error, userId: req.user.id });
    return errorResponse(res, { message: "Failed to clear cart", status: 500 });
  }
};
