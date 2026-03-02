const router = require("express").Router();
const { protect } = require("../../../decorators");
const { cart } = require("../../../controllers/v1/ordering");
const {
  addToCart,
  updateCartItem,
  deleteCartItem,
  getCartItems,
  getCartCount,
  clearCart,
} = cart;

router.get("/", ...protect(), getCartItems);
router.get("/count", ...protect(), getCartCount);
router.post("/", ...protect(), addToCart);
router.post("/items", ...protect(), addToCart);
router.patch("/items/:itemId", ...protect(), updateCartItem);
router.put("/items/:itemId", ...protect(), updateCartItem);
router.delete("/items/:itemId", ...protect(), deleteCartItem);
router.delete("/", ...protect(), clearCart);

module.exports = router;
