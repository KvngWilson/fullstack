const router = require("express").Router();
const { listProducts, createProduct, getProductById, replaceProduct, updateProductPartial, deleteProduct } = require("../controllers/product");

router.get("/", listProducts);
router.post("/", createProduct);
router.get("/:productId", getProductById);
router.put("/:productId", replaceProduct);
router.patch("/:productId", updateProductPartial);
router.delete("/:productId", deleteProduct);

module.exports = router;
