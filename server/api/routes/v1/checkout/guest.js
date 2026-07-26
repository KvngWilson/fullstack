/**
 * Guest Checkout Routes
 * Routes for non-authenticated (guest) checkout flow
 * Endpoints for guest session management, cart operations, and order creation
 */

const express = require("express");
const router = express.Router();

const guestCheckout = require("../../../controllers/v1/ordering/guest-checkout");
const { guestOnly } = require("../../../decorators/guest");
const { idempotency } = require("../../../middleware/idempotency");

/**
 * GET /api/v1/checkout/guest/session
 * First-visit session resolver:
 * - returns authenticated session when logged in
 * - reuses valid guest token when present
 * - creates new guest token when missing/expired
 */
router.get("/session", guestCheckout.getGuestEntrySession);

/**
 * POST /api/v1/checkout/guest/init
 * Initialize guest checkout session
 * Returns: { token, cartId, expiresIn }
 */
router.post("/init", guestCheckout.initGuestCheckout);

/**
 * GET /api/v1/checkout/guest
 * Get guest checkout data (cart, shipping options, etc)
 * Requires: guest token (x-guest-token header or guestToken cookie)
 */
router.get("/", guestOnly(), guestCheckout.getGuestCheckoutData);

/**
 * POST /api/v1/checkout/guest/session
 * Save guest contact information
 * Payload: { email, firstName, lastName, phone, address }
 * Requires: guest token
 */
router.post("/session", guestOnly(), guestCheckout.saveGuestSession);

/**
 * POST /api/v1/checkout/guest/finalize
 * Create order and process payment for guest
 * Payload: { email, firstName, lastName, phone, shippingAddress, shippingMethod, paymentMethod }
 * Returns: { orderId, total }
 * Requires: guest token
 */
router.post("/finalize", guestOnly(), idempotency(), guestCheckout.finalizeGuestCheckout);

/**
 * GET /api/v1/checkout/guest/convert
 * Get form to convert guest order to registered account
 * Query: ?orderId=123
 */
router.get("/convert", guestOnly(), guestCheckout.getConversionForm);

/**
 * POST /api/v1/checkout/guest/convert
 * Convert guest order to registered account
 * Payload: { orderId, email, password, confirmPassword }
 * Returns: { userId, message }
 */
router.post("/convert", guestOnly(), guestCheckout.convertGuestToAccount);

module.exports = router;
