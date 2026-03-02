const express = require('express');
const router = express.Router();
const { 
  protect, 
  body: bodyValidator 
} = require('../../../decorators');
const {
  validateUpdateUserProfile,
  validateChangePassword,
  validateDeleteAccount,
  validateAddAddress,
  validateUpdateAddress,
  validateAddSavedCard,
  validateSetPrimaryCard,
} = require('../../../validators/users');
const { profile } = require('../../../controllers/v1/identity');
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
} = profile;

// Profile routes
router.get('/', ...protect(), getProfile);
router.patch('/', ...protect(), ...bodyValidator(validateUpdateUserProfile), updateProfile);
router.patch('/password', ...protect(), ...bodyValidator(validateChangePassword), changePassword);
router.delete('/', ...protect(), ...bodyValidator(validateDeleteAccount), deleteAccount);

// Address routes
router.get('/addresses', ...protect(), getAddresses);
router.post('/addresses', ...protect(), ...bodyValidator(validateAddAddress), addAddress);
router.patch('/addresses/:addressId', ...protect(), ...bodyValidator(validateUpdateAddress), updateAddress);
router.delete('/addresses/:addressId', ...protect(), deleteAddress);

// Saved cards routes
router.get('/cards', ...protect(), getSavedCards);
router.post('/cards', ...protect(), ...bodyValidator(validateAddSavedCard), addSavedCard);
router.patch('/cards/:cardId', ...protect(), ...bodyValidator(validateSetPrimaryCard), setPrimaryCard);
router.delete('/cards/:cardId', ...protect(), deleteSavedCard);

module.exports = router;
