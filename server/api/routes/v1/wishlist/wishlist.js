const express = require("express");
const router = express.Router();
const { protect, body } = require("../../../decorators");
const { privateData } = require("../../../middleware/cache-headers");
const { validateAddToWishlist } = require("../../../validators/wishlist");
const { wishlist } = require("../../../controllers/v1/wishlist");
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  clearWishlist,
} = wishlist;

// All wishlist routes require authentication and are user-specific
router.use(...protect());
router.use(privateData);

// Get user's wishlist
router.get("/", getWishlist);

// Add product to wishlist
router.post("/", ...body(validateAddToWishlist), addToWishlist);

// Check if product is in wishlist
router.get("/check/:product_id", isInWishlist);

// Remove product from wishlist
router.delete("/:product_id", removeFromWishlist);

// Clear entire wishlist
router.delete("/", clearWishlist);

module.exports = router;
