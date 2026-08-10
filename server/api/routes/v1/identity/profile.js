const express = require("express");
const router = express.Router();
const { protect, body: bodyValidator } = require("../../../decorators");
const { privateData } = require("../../../middleware/cache-headers");
const {
  validateUpdateUserProfile,
  validateChangePassword,
  validateDeleteAccount,
  validateAddAddress,
  validateUpdateAddress,
  validateAddSavedCard,
  validateSetPrimaryCard,
} = require("../../../validators/users");
const { profile } = require("../../../controllers/v1/identity");
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

function normalizeAddressPayload(req, res, next) {
  if (req.body && req.body.address_type !== undefined && req.body.type === undefined) {
    req.body.type = req.body.address_type;
  }
  if (req.body && req.body.is_default !== undefined && req.body.is_primary === undefined) {
    req.body.is_primary = req.body.is_default;
  }
  next();
}

function normalizeSavedCardPayload(req, res, next) {
  if (req.body && req.body.card_last_four !== undefined && req.body.last_four === undefined) {
    req.body.last_four = req.body.card_last_four;
  }
  if (req.body && typeof req.body.card_brand === "string") {
    req.body.card_brand = req.body.card_brand.toLowerCase();
  }
  next();
}

function forcePrimaryCardBody(req, res, next) {
  req.body = {
    ...(req.body || {}),
    isPrimary: true,
    is_primary: true,
  };
  next();
}

// Profile routes (private, user-specific data)
router.get("/", ...protect(), privateData, getProfile);
router.patch(
  "/",
  ...protect(),
  privateData,
  ...bodyValidator(validateUpdateUserProfile),
  updateProfile,
);
router.patch(
  "/password",
  ...protect(),
  privateData,
  ...bodyValidator(validateChangePassword),
  changePassword,
);
router.post(
  "/change-password",
  ...protect(),
  privateData,
  ...bodyValidator(validateChangePassword),
  changePassword,
);
router.delete(
  "/",
  ...protect(),
  privateData,
  ...bodyValidator(validateDeleteAccount),
  deleteAccount,
);

// Address routes (private, user-specific data)
router.get("/addresses", ...protect(), privateData, getAddresses);
router.post(
  "/addresses",
  ...protect(),
  privateData,
  normalizeAddressPayload,
  ...bodyValidator(validateAddAddress),
  addAddress,
);
router.patch(
  "/addresses/:addressId",
  ...protect(),
  privateData,
  normalizeAddressPayload,
  ...bodyValidator(validateUpdateAddress),
  updateAddress,
);
router.put(
  "/addresses/:addressId",
  ...protect(),
  privateData,
  normalizeAddressPayload,
  ...bodyValidator(validateUpdateAddress),
  updateAddress,
);
router.delete(
  "/addresses/:addressId",
  ...protect(),
  privateData,
  deleteAddress,
);

// Saved cards routes (private, sensitive user data)
router.get("/cards", ...protect(), privateData, getSavedCards);
router.post(
  "/cards",
  ...protect(),
  privateData,
  normalizeSavedCardPayload,
  ...bodyValidator(validateAddSavedCard),
  addSavedCard,
);
router.patch(
  "/cards/:cardId",
  ...protect(),
  privateData,
  ...bodyValidator(validateSetPrimaryCard),
  setPrimaryCard,
);
router.put(
  "/cards/:cardId/primary",
  ...protect(),
  privateData,
  forcePrimaryCardBody,
  ...bodyValidator(validateSetPrimaryCard),
  setPrimaryCard,
);
router.delete("/cards/:cardId", ...protect(), privateData, deleteSavedCard);

module.exports = router;
