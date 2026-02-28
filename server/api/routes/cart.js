const router = require("express").Router();
const {
  addToCart,
  updateCartItem,
  deleteCartItem,
  getCartItems,
  getCartCount,
  clearCart,
} = require("../controllers/cart");

router.get("/", getCartItems);
router.get("/count", getCartCount);
router.post("/", addToCart);
router.post("/items", addToCart);
router.patch("/items/:itemId", updateCartItem);
router.put("/items/:itemId", updateCartItem);
router.delete("/items/:itemId", deleteCartItem);
router.delete("/", clearCart);

module.exports = router;
