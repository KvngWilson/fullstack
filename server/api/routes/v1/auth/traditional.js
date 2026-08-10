const express = require("express");
const { rateAuth } = require("../../../decorators");
const { auth } = require("../../../controllers/v1/auth");
const {
  renderLogin,
  renderRegister,
  postRegister,
  postLogin,
  postLogout,
} = auth;

const router = express.Router();

router.get("/login", renderLogin);
router.get("/register", renderRegister);
router.post("/login", ...rateAuth(), postLogin);
router.post("/register", ...rateAuth(), postRegister);
router.post("/logout", postLogout);

module.exports = router;
