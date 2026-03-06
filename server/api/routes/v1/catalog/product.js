const router = require("express").Router();
const { admin, body } = require("../../../decorators");
const { apiCache } = require("../../../middleware/cache-headers");
const { withProductImageUpload } = require("../../../middleware/productImageUpload");
const {
  validateCreateProduct,
  validateUpdateProduct,
} = require("../../../validators/catalog");
const { product } = require("../../../controllers/v1/catalog");
const {
  listProducts,
  createProduct,
  getProductById,
  replaceProduct,
  updateProductPartial,
  deleteProduct,
  getProductCategories,
  getFeaturedProducts,
} = product;

router.get("/", apiCache, listProducts);
router.get("/categories", apiCache, getProductCategories);
router.get("/featured", apiCache, getFeaturedProducts);
router.post("/", ...admin(), withProductImageUpload, ...body(validateCreateProduct), createProduct);
router.get("/:productId", apiCache, getProductById);
router.put(
  "/:productId",
  ...admin(),
  withProductImageUpload,
  ...body(validateUpdateProduct),
  replaceProduct,
);
router.patch(
  "/:productId",
  ...admin(),
  withProductImageUpload,
  ...body(validateUpdateProduct),
  updateProductPartial,
);
router.delete("/:productId", ...admin(), deleteProduct);

module.exports = router;
