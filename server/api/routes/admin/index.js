const router = require("express").Router();

const authRouter = require("./auth");
const adminRouter = require("./admin");

// Admin authentication (SSR)
router.use("/auth", authRouter);

// Admin dashboard and management
router.use("/", adminRouter);

module.exports = router;
