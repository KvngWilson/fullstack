const express = require("express");
const router = express.Router();

const vendorApplicationRoutes = require("./vendor-application");
// Note: employees routes are already migrated to identity domain
// If vendor also needs employee management, link them here or use identity/employees

/**
 * Vendor Domain Routes
 * Vendor applications, profiles, and management
 */
router.use("/", vendorApplicationRoutes);

module.exports = router;
