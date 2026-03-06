const express = require("express");
const router = express.Router();

const vendorApplicationRoutes = require("./vendor-application");

/**
 * Vendor Domain Routes
 * Vendor applications, profiles, and management
 */
router.use("/", vendorApplicationRoutes);

module.exports = router;
