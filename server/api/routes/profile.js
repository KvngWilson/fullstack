const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../config/auth');
const {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getSavedCards,
  addSavedCard,
  setPrimaryCard,
  deleteSavedCard,
} = require('../controllers/profile');

// Profile routes
router.get('/', authenticateJWT, getProfile);
router.put('/', authenticateJWT, updateProfile);
router.post('/change-password', authenticateJWT, changePassword);
router.delete('/', authenticateJWT, deleteAccount);

// Address routes
router.get('/addresses', authenticateJWT, getAddresses);
router.post('/addresses', authenticateJWT, addAddress);
router.put('/addresses/:addressId', authenticateJWT, updateAddress);
router.delete('/addresses/:addressId', authenticateJWT, deleteAddress);

// Saved cards routes
router.get('/cards', authenticateJWT, getSavedCards);
router.post('/cards', authenticateJWT, addSavedCard);
router.put('/cards/:cardId/primary', authenticateJWT, setPrimaryCard);
router.delete('/cards/:cardId', authenticateJWT, deleteSavedCard);

module.exports = router;
