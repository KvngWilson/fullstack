/**
 * Ordering Domain Routes
 * Shopping cart, orders, checkout, and shipping
 */

const express = require("express");
const router = express.Router();

const cartRoutes = require("./cart");
const ordersRoutes = require("./orders");
const checkoutRoutes = require("./checkout");
const shippingRoutes = require("./shipping");

router.use("/cart", cartRoutes);
router.use("/orders", ordersRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/shipping", shippingRoutes);

module.exports = router;
