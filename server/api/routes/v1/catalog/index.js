/**
 * Catalog Domain Routes
 * Product catalog and category management
 */

const express = require("express");
const router = express.Router();

const productRoutes = require("./product");

router.use("/products", productRoutes);

module.exports = router;
