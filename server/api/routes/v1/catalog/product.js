const router = require("express").Router();
const { admin } = require("../../../decorators");
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

router.get("/", listProducts);
router.get("/categories", getProductCategories);
router.get("/featured", getFeaturedProducts);
router.post("/", ...admin(), createProduct);
router.get("/:productId", getProductById);
router.put("/:productId", ...admin(), replaceProduct);
router.patch("/:productId", ...admin(), updateProductPartial);
router.delete("/:productId", ...admin(), deleteProduct);

module.exports = router;
