/**
 * Payments Domain Routes
 * Payment processing and financial transactions
 */

const express = require("express");
const router = express.Router();

const paymentRoutes = require("./payment");

router.use("/", paymentRoutes);

module.exports = router;
