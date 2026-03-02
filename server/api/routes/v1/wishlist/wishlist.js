const express = require('express');
const router = express.Router();
const { protect } = require('../../../decorators');
const { wishlist } = require('../../../controllers/v1/wishlist');
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  clearWishlist,
} = wishlist;

// All wishlist routes require authentication
router.use(...protect());

// Get user's wishlist
router.get('/', getWishlist);

// Add product to wishlist
router.post('/', addToWishlist);

// Check if product is in wishlist
router.get('/check/:product_id', isInWishlist);

// Remove product from wishlist
router.delete('/:product_id', removeFromWishlist);

// Clear entire wishlist
router.delete('/', clearWishlist);

module.exports = router;
