/**
 * Guest Checkout Controller
 * Handles checkout for non-authenticated (guest) users
 * Creates orders for guest sessions and links them to customer accounts
 */

const logger = require("../../../../shared/utils/logger");
const { pool } = require("../../../../config/db");
const domain = require("../../../../domain");
const AuthenticationService = domain.identity.services.AuthenticationService;
const crypto = require("crypto");
const argon2 = require("argon2");
const { verifyToken } = require("../../../../config/auth");
const GuestCartService = require("../../../../domain/ordering/services/GuestCartService");
const {
  getShippingRates,
} = require("../../../../domain/ordering/services/ShippingService");
const taxService = require("../../../../domain/ordering/services/TaxService");
const eventDispatcher = require("../../../../domain/shared/events/dispatcher");

const guestCartService = new GuestCartService();

function getAuthTokenFromRequest(req = {}) {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return req.cookies?.token || req.cookies?.authToken || req.cookies?.access_token || null;
}

function setGuestTokenCookie(res, token) {
  if (!token || !res || typeof res.cookie !== "function") {
    return;
  }

  res.cookie("guestToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  });
}

/**
 * GET /api/v1/checkout/guest/session
 * Resolve entry session for storefront:
 * - Authenticated users: return authenticated=true, no guest token rotation
 * - Guests with valid token: return existing guest session
 * - First-time/expired guest: create and return new guest token
 */
exports.getGuestEntrySession = async (req, res) => {
  try {
    const authToken = getAuthTokenFromRequest(req);
    if (authToken) {
      const decoded = verifyToken(authToken);
      if (decoded) {
        return res.json({
          success: true,
          authenticated: true,
          guest: false,
          user: {
            id: decoded.id || decoded.userId || null,
            email: decoded.email || null,
            role: decoded.role || null,
          },
        });
      }
    }

    const incomingGuestToken = req.headers?.["x-guest-token"] || req.cookies?.guestToken;
    if (incomingGuestToken) {
      const existingSession = await guestCartService.getGuestSession(incomingGuestToken);
      if (existingSession) {
        setGuestTokenCookie(res, incomingGuestToken);
        return res.json({
          success: true,
          authenticated: false,
          guest: true,
          token: incomingGuestToken,
          existing: true,
          expiresIn: 86400,
        });
      }
    }

    const { token, cartId } = await guestCartService.createGuestCart();
    setGuestTokenCookie(res, token);

    return res.status(201).json({
      success: true,
      authenticated: false,
      guest: true,
      token,
      cartId,
      existing: false,
      expiresIn: 86400,
      message: "Guest session created.",
    });
  } catch (error) {
    logger.error("Failed to resolve guest entry session", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to resolve session",
    });
  }
};

function conversionError(status, error, message = null) {
  const err = new Error(message || error);
  err.status = status;
  err.publicError = error;
  return err;
}

function buildOrderNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const entropy = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ORD-${timestamp}-${entropy}`;
}

/**
 * POST /api/v1/checkout/guest/init
 * Initialize guest checkout session
 * Creates guest token and empty cart
 *
 * Response: { token, cartId, expiresIn: 86400 }
 */
exports.initGuestCheckout = async (req, res) => {
  try {
    const { token, cartId } = await guestCartService.createGuestCart();

    setGuestTokenCookie(res, token);

    logger.info("Guest checkout initialized", {
      token: token.substring(0, 8),
    });

    return res.status(201).json({
      success: true,
      token,
      cartId,
      expiresIn: 86400, // 24 hours in seconds
      message:
        "Guest session created. You can now browse and add items to cart.",
    });
  } catch (error) {
    logger.error("Failed to initialize guest checkout", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to initialize guest session",
      message: error.message,
    });
  }
};

/**
 * GET /api/v1/checkout/guest
 * Get guest checkout data (cart items, shipping rates, etc)
 * Requires: guestOrAuth() decorator with guest token
 */
exports.getGuestCheckoutData = async (req, res) => {
  try {
    const guestToken = req.guest?.token;

    if (!guestToken) {
      return res.status(400).json({
        error: "Missing guest token",
      });
    }

    // Get cart items
    const cartSnapshot =
      await guestCartService.getGuestCartSnapshot(guestToken);
    const cartItems = cartSnapshot.items;

    // Get guest session info
    const session = await guestCartService.getGuestSession(guestToken);

    if (cartItems.length === 0) {
      return res.json({
        cartItems: [],
        total: 0,
        shippingRates: [],
        shippingError: "Cart is empty",
        session: session || null,
      });
    }

    let shippingRates = [];
    let shippingError = null;

    // Calculate shipping rates if address provided
    if (session?.address) {
      const shippingParams = {
        destination: {
          country_code: session.address.country || "US",
          city: session.address.city,
          postal_code: session.address.postalCode,
          state: session.address.state || "",
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

      const shippingResult = await getShippingRates(shippingParams);

      if (shippingResult.success) {
        shippingRates = shippingResult.rates.slice(0, 5).map((rate) => ({
          id: rate.courierId,
          name: rate.courierName,
          service: rate.serviceName,
          cost: Number((Number(rate.totalChargeMinor || 0) / 100).toFixed(2)),
          currency: rate.currency,
          minDeliveryTime: rate.minDeliveryDays,
          maxDeliveryTime: rate.maxDeliveryDays,
          logoUrl: null,
        }));
      } else {
        shippingError = shippingResult.message;
      }
    }

    return res.json({
      cartItems,
      total: cartSnapshot.total,
      shippingRates,
      shippingError,
      session: session || null,
    });
  } catch (error) {
    logger.error("Failed to get guest checkout data", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to load checkout data",
    });
  }
};

/**
 * POST /api/v1/checkout/guest/session
 * Save guest session info (email, address, etc)
 *
 * Body: {
 *   email,
 *   firstName,
 *   lastName,
 *   phone,
 *   address: { street, city, state, postalCode, country }
 * }
 */
exports.saveGuestSession = async (req, res) => {
  try {
    const guestToken = req.guest?.token;
    const { email, firstName, lastName, phone, address } = req.body;

    if (!guestToken) {
      return res.status(400).json({
        error: "Missing guest token",
      });
    }

    if (!email || !firstName || !lastName) {
      return res.status(400).json({
        error: "Email, firstName, and lastName are required",
      });
    }

    // Save to Redis
    const sessionData = {
      email,
      firstName,
      lastName,
      phone,
      address,
    };

    await guestCartService.saveGuestSession(guestToken, sessionData);

    logger.info("Guest session saved", {
      token: guestToken.substring(0, 8),
      email,
    });

    return res.json({
      success: true,
      message: "Session information saved",
    });
  } catch (error) {
    logger.error("Failed to save guest session", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to save session information",
    });
  }
};

/**
 * POST /api/v1/checkout/guest/finalize
 * Create order and process payment for guest
 *
 * Body: {
 *   email,
 *   firstName,
 *   lastName,
 *   phone,
 *   shippingAddress: { street, city, state, postalCode, country },
 *   billingAddress: { same as shipping },
 *   shippingMethod: { id, cost },
 *   paymentMethod: { type, token | id }
 * }
 *
 * Returns: { orderId, total, message }
 */
exports.finalizeGuestCheckout = async (req, res) => {
  const client = await pool.connect();

  try {
    const guestToken = req.guest?.token;
    const {
      email,
      firstName,
      lastName,
      phone,
      shippingAddress,
      billingAddress,
      shippingMethod,
      paymentMethod,
    } = req.body;

    if (!guestToken) {
      return res.status(400).json({
        error: "Missing guest token",
      });
    }

    // Validate required fields
    if (!email || !firstName || !lastName) {
      return res.status(400).json({
        error: "Email, firstName, and lastName are required",
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        error: "Shipping address is required",
      });
    }

    if (!shippingMethod || !shippingMethod.cost) {
      return res.status(400).json({
        error: "Shipping method with cost is required",
      });
    }

    await guestCartService.saveGuestSession(guestToken, {
      email,
      firstName,
      lastName,
      phone,
      address: shippingAddress,
    });

    // Get cart items
    const cartItems =
      await guestCartService.getGuestCartItemsForOrder(guestToken);

    if (cartItems.length === 0) {
      return res.status(400).json({
        error: "Cart is empty",
      });
    }

    // Validate cart
    const validation = await guestCartService.validateGuestCart(guestToken);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
      });
    }

    await client.query("BEGIN");

    try {
      // Calculate totals
      const subtotal = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const shippingCost = parseFloat(shippingMethod.cost);
      const tax = taxService.calculateFromMajor(subtotal, {
        address: shippingAddress,
      });
      const total = parseFloat((subtotal + shippingCost + tax).toFixed(2));

      const subtotalCents = Math.round(subtotal * 100);
      const taxCents = Math.round(tax * 100);
      const shippingCents = Math.round(shippingCost * 100);
      const totalCents = Math.round(total * 100);
      const orderNumber = buildOrderNumber();
      const guestName = [firstName, lastName].filter(Boolean).join(" ").trim();

      // Create guest order using canonical monetary schema
      const orderResult = await client.query(
        `INSERT INTO orders (
          user_id,
          order_number,
          payment_status,
          status,
          currency,
          subtotal_cents,
          tax_cents,
          shipping_cents,
          total_cents,
          guest_email,
          guest_name,
          shipping_first_name,
          shipping_last_name,
          shipping_email,
          shipping_phone,
          shipping_street_address,
          shipping_city,
          shipping_state,
          shipping_postal_code,
          shipping_country,
          created_at,
          updated_at
        ) VALUES (
          NULL, $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
          now(), now()
        ) RETURNING id`,
        [
          orderNumber,
          "pending",
          "pending",
          "USD",
          subtotalCents,
          taxCents,
          shippingCents,
          totalCents,
          email,
          guestName || null,
          firstName || null,
          lastName || null,
          email,
          phone || null,
          shippingAddress.street || null,
          shippingAddress.city || null,
          shippingAddress.state || null,
          shippingAddress.postalCode || null,
          shippingAddress.country || null,
        ],
      );

      const orderId = orderResult.rows[0].id;

      // Create order items
      for (const item of cartItems) {
        await client.query(
          `INSERT INTO order_items (
            order_id,
            product_variant_id,
            quantity,
            unit_price_cents,
            subtotal_cents
          ) VALUES (
            $1, $2, $3, $4, $5
          )`,
          [
            orderId,
            item.productVariantId,
            item.quantity,
            Math.round(item.price * 100),
            Math.round(item.price * item.quantity * 100),
          ],
        );
      }

      logger.info("Guest order created", {
        orderId,
        email,
        total,
      });

      await eventDispatcher.publishAll([
        {
          type: "order.created",
          occurredAt: new Date(),
          orderId,
          userId: null,
          guestEmail: email,
          total,
          currency: "USD",
        },
        {
          type: "payment.initiated",
          occurredAt: new Date(),
          orderId,
          userId: null,
          amount: total,
          currency: "USD",
          processor: paymentMethod?.type || "pending",
        },
        {
          type: "inventory.reserved",
          occurredAt: new Date(),
          orderId,
          userId: null,
          items: cartItems.map((item) => ({
            productVariantId: item.productVariantId,
            quantity: item.quantity,
          })),
        },
      ]);

      // Clear guest cart
      await guestCartService.clearGuestCart(guestToken);

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        orderId,
        total,
        email,
        message:
          "Order created successfully. Check your email for confirmation.",
        nextSteps: "You can optionally create an account to track your order.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    logger.error("Failed to finalize guest checkout", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to create order",
      message: error.message,
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/v1/checkout/guest/convert
 * Get form to convert guest order to registered account
 * After guest checkout, offer to create account
 */
exports.getConversionForm = async (req, res) => {
  try {
    const orderId = req.query.orderId;
    const guestSessionEmail = String(req.guest?.session?.email || "")
      .trim()
      .toLowerCase();

    if (!orderId) {
      return res.status(400).json({
        error: "orderId query parameter is required",
      });
    }

    // Get order guest details
    const orderResult = await pool.query(
      `SELECT
         o.id,
         o.user_id,
         o.guest_email,
         o.guest_name,
         o.shipping_first_name,
         o.shipping_last_name
       FROM orders o
       WHERE o.id = $1`,
      [orderId],
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    const order = orderResult.rows[0];
    const orderGuestEmail = String(order.guest_email || "").trim().toLowerCase();

    if (!guestSessionEmail || !orderGuestEmail || guestSessionEmail !== orderGuestEmail) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Guest session does not match this order",
      });
    }

    const name = order.guest_name || [order.shipping_first_name, order.shipping_last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    return res.json({
      orderId: order.id,
      email: order.guest_email,
      name,
      message:
        "Create an account to track your order and access faster checkout next time.",
    });
  } catch (error) {
    logger.error("Failed to get conversion form", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to load conversion form",
    });
  }
};

/**
 * POST /api/v1/checkout/guest/convert
 * Convert guest order to registered account
 *
 * Body: {
 *   orderId,
 *   email,
 *   password,
 *   confirmPassword
 * }
 */
exports.convertGuestToAccount = async (req, res) => {
  const client = await pool.connect();

  try {
    const { orderId, email, password, confirmPassword } = req.body;
    const guestSessionEmail = String(req.guest?.session?.email || "")
      .trim()
      .toLowerCase();

    if (!orderId || !email || !password) {
      return res.status(400).json({
        error: "OrderId, email, and password are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: "Passwords do not match",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
    }

    if (!guestSessionEmail) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Guest session is required",
      });
    }

    await client.query("BEGIN");

    try {
      // Verify order exists and is still a guest order
      const orderResult = await client.query(
        `SELECT o.id, o.guest_email, o.user_id
         FROM orders o
         WHERE o.id = $1`,
        [orderId],
      );

      if (orderResult.rows.length === 0) {
        throw conversionError(404, "Order not found");
      }

      const order = orderResult.rows[0];
      const requestedEmail = email.toLowerCase();
      const guestEmail = (order.guest_email || "").toLowerCase();

      if (order.user_id) {
        throw conversionError(400, "Order is already linked to an account");
      }

      if (!guestEmail || guestEmail !== requestedEmail) {
        throw conversionError(400, "Email does not match the guest order");
      }

      if (guestSessionEmail !== requestedEmail) {
        throw conversionError(
          403,
          "Forbidden",
          "Guest session does not match conversion email",
        );
      }

      const existing = await client.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
        [requestedEmail],
      );

      let linkedUserId;

      if (existing.rows.length > 0) {
        throw conversionError(
          409,
          "Account already exists for this email. Please sign in to claim your order.",
        );
      } else {
        const passwordHash = await argon2.hash(password);
        const createdUser = await client.query(
          `INSERT INTO users (email, password_hash, role, email_verified, is_active, created_at, updated_at)
           VALUES ($1, $2, 'customer', false, true, now(), now())
           RETURNING id`,
          [requestedEmail, passwordHash],
        );
        linkedUserId = createdUser.rows[0].id;
      }

      // Link only the requested guest order to this account.
      await client.query(
        `UPDATE orders
         SET user_id = $1,
             guest_email = NULL,
             guest_name = NULL,
             updated_at = now()
         WHERE id = $2
           AND user_id IS NULL
           AND LOWER(guest_email) = LOWER($3)`,
        [linkedUserId, orderId, requestedEmail],
      );

      // Log event
      await client.query(
        `INSERT INTO security_audit_log (
          event_type, actor_id, target_id, description, metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, now()
        )`,
        [
          "guest_order_converted",
          linkedUserId,
          linkedUserId,
          `Guest order account enabled with password`,
          JSON.stringify({ orderId }),
        ],
      );

      logger.info("Guest order converted to account", {
        orderId,
        userId: linkedUserId,
        email,
      });

      await client.query("COMMIT");

      return res.json({
        success: true,
        userId: linkedUserId,
        message: "Account created successfully. You can now track your order.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    logger.error("Failed to convert guest to account", {
      error: error.message,
    });

    if (error.status) {
      return res.status(error.status).json({
        error: error.publicError || error.message,
      });
    }

    return res.status(500).json({
      error: "Failed to create account",
    });
  } finally {
    client.release();
  }
};
