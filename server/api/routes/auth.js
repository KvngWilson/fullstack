const express = require("express");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  renderLogin,
  renderRegister,
  postRegister,
  postLogin,
  postLogout,
} = require("../controllers/auth");

const router = express.Router();

router.get("/login", renderLogin);
router.get("/register", renderRegister);
router.post("/login", authLimiter, postLogin);
router.post("/register", authLimiter, postRegister);
router.post("/logout", postLogout);

module.exports = router;
