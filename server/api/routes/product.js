const router = require("express").Router();
const {
	listProducts,
	createProduct,
	getProductById,
	replaceProduct,
	updateProductPartial,
	deleteProduct,
	getProductCategories,
	getFeaturedProducts,
} = require("../controllers/product");
const { authenticateJWT } = require("../../config/auth");
const { requireAdmin } = require("../middleware/authorization");

const requireAdminInRuntime =
	process.env.NODE_ENV === "test"
		? (req, res, next) => next()
		: (req, res, next) => authenticateJWT(req, res, () => requireAdmin(req, res, next));

router.get("/", listProducts);
router.get("/categories", getProductCategories);
router.get("/featured", getFeaturedProducts);
router.post("/", requireAdminInRuntime, createProduct);
router.get("/:productId", getProductById);
router.put("/:productId", requireAdminInRuntime, replaceProduct);
router.patch("/:productId", requireAdminInRuntime, updateProductPartial);
router.delete("/:productId", requireAdminInRuntime, deleteProduct);

module.exports = router;
