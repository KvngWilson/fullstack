const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../config/auth');
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  clearWishlist,
} = require('../controllers/wishlist');

// All wishlist routes require authentication
router.use(authenticateJWT);

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
