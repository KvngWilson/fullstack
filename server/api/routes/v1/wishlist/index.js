/**
 * Wishlist Domain Routes
 * User's product wishlist operations
 */

const express = require("express");
const router = express.Router();

const wishlistRoutes = require("./wishlist");

router.use("/", wishlistRoutes);

module.exports = router;
