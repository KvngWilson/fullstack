exports.getCartItems = async (req, res) => {
  try {
    // Get or create cart for user
    let cartResult = await pool.query(
      "SELECT id FROM carts WHERE user_id = $1",
      [req.user.id]
    );

    let cartId;
    if (cartResult.rows.length === 0) {
      // Create cart if doesn't exist
      const newCart = await pool.query(
        "INSERT INTO carts (user_id) VALUES ($1) RETURNING id",
        [req.user.id]
      );
      cartId = newCart.rows[0].id;
    } else {
      cartId = cartResult.rows[0].id;
    }

    // Get cart items with product details
    const items = await pool.query(
      `SELECT ci.cart_item_id, ci.variant_id, ci.quantity, ci.added_at,
              v.sku, v.size, v.color, v.price_adjustment,
              p.id as product_id, p.name, p.base_price, p.brand
       FROM cart_items ci
       JOIN variants v ON ci.variant_id = v.id
       JOIN products p ON v.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    res.json({
      cart_id: cartId,
      items: items.rows,
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { variant_id, quantity } = req.body;

    if (!variant_id || !quantity || quantity < 1) {
      return res
        .status(400)
        .json({ error: "variant_id and quantity (>0) are required" });
    }

    // Get or create cart
    let cartResult = await pool.query(
      "SELECT id FROM carts WHERE user_id = $1",
      [req.user.id]
    );

    let cartId;
    if (cartResult.rows.length === 0) {
      const newCart = await pool.query(
        "INSERT INTO carts (user_id) VALUES ($1) RETURNING id",
        [req.user.id]
      );
      cartId = newCart.rows[0].id;
    } else {
      cartId = cartResult.rows[0].id;
    }

    // Check if item already in cart
    const existing = await pool.query(
      "SELECT cart_item_id, quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2",
      [cartId, variant_id]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update quantity
      result = await pool.query(
        "UPDATE cart_items SET quantity = quantity + $1 WHERE cart_item_id = $2 RETURNING *",
        [quantity, existing.rows[0].cart_item_id]
      );
    } else {
      // Insert new item
      result = await pool.query(
        "INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, $3) RETURNING *",
        [cartId, variant_id, quantity]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "quantity must be greater than 0" });
    }

    // Verify item belongs to user's cart
    const result = await pool.query(
      `UPDATE cart_items ci
       SET quantity = $1
       FROM carts c
       WHERE ci.cart_item_id = $2 
       AND ci.cart_id = c.id 
       AND c.user_id = $3
       RETURNING ci.*`,
      [quantity, itemId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update cart item error:", error);
    res.status(500).json({ error: "Failed to update cart item" });
  }
};

exports.deleteCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    // Verify item belongs to user's cart
    const result = await pool.query(
      `DELETE FROM cart_items ci
       USING carts c
       WHERE ci.cart_item_id = $1 
       AND ci.cart_id = c.id 
       AND c.user_id = $2
       RETURNING ci.*`,
      [itemId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    res.json({ message: "Cart item removed successfully" });
  } catch (error) {
    console.error("Remove cart item error:", error);
    res.status(500).json({ error: "Failed to remove cart item" });
  }
};
