const router = require("express").Router();
const adminApiRouter = require("../v1/admin");

const authRouter = require("./auth");
const adminRouter = require("./admin");
const analyticsRouter = require("./analytics");
const contentRouter = require("./content");

// Admin authentication (SSR)
router.use("/auth", authRouter);

// Admin dashboard and management
router.use("/", adminRouter);
router.use("/analytics", analyticsRouter);
router.use("/content", contentRouter);

module.exports = router;
