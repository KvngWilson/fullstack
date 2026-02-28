const router = require("express").Router();
const { pool } = require("../../config/db");
const { authenticateJWT } = require("../../config/auth");
const { calculateShippingRates } = require("../../core/services/shipping");

// Checkout page (server-rendered)
router.get("/checkout", authenticateJWT, async (req, res, next) => {
  try {
    // Fetch cart items for the user
    const cartResult = await pool.query(
      `SELECT c.id as cart_id, ci.id, ci.quantity, p.name,
              pv.sku, pv.price as variant_price, p.description,
              COALESCE(p.weight, 0.5) as weight
       FROM carts c
       JOIN cart_items ci ON c.id = ci.cart_id
       JOIN product_variants pv ON ci.product_variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE c.user_id = $1`,
      [req.user.id]
    );

    const cartItems = cartResult.rows.map((item) => ({
      ...item,
      price: item.variant_price,
      subtotal: item.variant_price * item.quantity,
    }));

    const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Fetch user addresses
    const addressResult = await pool.query(
      "SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC",
      [req.user.id]
    );

    const addresses = addressResult.rows;

    // Calculate shipping rates if there's a default address
    let shippingRates = [];
    let shippingError = null;

    const defaultAddress = addresses.find((a) => a.is_default) || addresses[0];

    if (defaultAddress && cartItems.length > 0) {
      const shippingParams = {
        destination: {
          country_code: defaultAddress.country || "US",
          city: defaultAddress.city,
          postal_code: defaultAddress.postal_code,
          state: defaultAddress.state || "",
        },
        origin: {
          country_code: "US",
          city: "San Francisco",
          postal_code: "94102",
          state: "CA",
        },
        items: cartItems.map((item) => ({
          description: item.name,
          quantity: item.quantity,
          value: item.price,
          weight: item.weight || 0.5,
          height: 10,
          width: 10,
          length: 10,
          currency: "USD",
          category: "general",
        })),
      };

      const shippingResult = await calculateShippingRates(shippingParams);

      if (shippingResult.success) {
        shippingRates = shippingResult.rates.slice(0, 5).map((rate) => ({
          id: rate.courier_id,
          name: rate.courier_name,
          service: rate.service_name,
          cost: parseFloat(rate.total_charge || 0),
          currency: rate.currency,
          min_delivery_time: rate.min_delivery_time,
          max_delivery_time: rate.max_delivery_time,
          logo_url: rate.courier_logo_url,
        }));
      } else {
        shippingError = shippingResult.message;
      }
    }

    res.render("checkout", {
      user: req.user,
      cartItems,
      total,
      addresses,
      shippingRates,
      shippingError,
      selectedShipping: shippingRates[0] || null,
    });
  } catch (err) {
    next(err);
  }
});