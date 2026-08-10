const router = require("express").Router();
const { protect, body } = require("../../../decorators");
const {
  validateAddToCart,
  validateUpdateCartItem,
} = require("../../../validators/order");
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
router.post("/", ...protect(), ...body(validateAddToCart), addToCart);
router.post("/items", ...protect(), ...body(validateAddToCart), addToCart);
router.patch(
  "/items/:itemId",
  ...protect(),
  ...body(validateUpdateCartItem),
  updateCartItem,
);
router.put(
  "/items/:itemId",
  ...protect(),
  ...body(validateUpdateCartItem),
  updateCartItem,
);
router.delete("/items/:itemId", ...protect(), deleteCartItem);
router.delete("/", ...protect(), clearCart);

module.exports = router;
