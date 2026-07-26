const express = require("express");
const { protect, permission } = require("../../../decorators");
const translationsControllers = require("../../../controllers/v1/admin/translations");
const PERMISSIONS = require("../../../../shared/constants/permissions");

const router = express.Router();

/**
 * Admin Translations Management Routes
 * Public read endpoints remain open
 * Write endpoints require authentication and explicit permission checks
 */

// GET /api/v1/admin/translations/languages - List supported languages
router.get("/languages", translationsControllers.listLanguages);

// Product Translations Routes
// GET /api/v1/admin/translations/products/:productId - Get product translations
router.get(
  "/products/:productId",
  translationsControllers.getProductTranslations,
);

// Category Translations Routes
// GET /api/v1/admin/translations/categories/:categoryId - Get category translations
router.get(
  "/categories/:categoryId",
  translationsControllers.getCategoryTranslations,
);

// POST /api/v1/admin/translations/products/:productId - Create product translation
router.use(...protect(), ...permission(PERMISSIONS.TRANSLATION.MANAGE));

router.post(
  "/products/:productId",
  translationsControllers.createProductTranslation,
);

// PUT /api/v1/admin/translations/products/:productId/:translationId - Update product translation
router.put(
  "/products/:productId/:translationId",
  translationsControllers.updateProductTranslation,
);

// DELETE /api/v1/admin/translations/products/:productId/:translationId - Delete product translation
router.delete(
  "/products/:productId/:translationId",
  translationsControllers.deleteProductTranslation,
);

// POST /api/v1/admin/translations/categories/:categoryId - Create category translation
router.post(
  "/categories/:categoryId",
  translationsControllers.createCategoryTranslation,
);

// PUT /api/v1/admin/translations/categories/:categoryId/:translationId - Update category translation
router.put(
  "/categories/:categoryId/:translationId",
  translationsControllers.updateCategoryTranslation,
);

// DELETE /api/v1/admin/translations/categories/:categoryId/:translationId - Delete category translation
router.delete(
  "/categories/:categoryId/:translationId",
  translationsControllers.deleteCategoryTranslation,
);

module.exports = router;
