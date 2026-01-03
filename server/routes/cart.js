const router = require("express").Router();
const { pool } = require("../config/db");
const { authenticateJWT } = require("../config/auth");
const {
  addToCart,
  updateCartItem,
  deleteCartItem,
  getCartItems,
} = require("../controllers/cart");

router.get("/", getCartItems);
router.post("/items", addToCart);
router.patch("/items/:itemId", updateCartItem);
router.delete("/items/:itemId", deleteCartItem);

module.exports = router;
