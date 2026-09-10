const express = require("express");
const { admin } = require("../../../decorators");
const productControllers = require("../../../controllers/v1/admin/products");

const router = express.Router();

router.get("/vendors", ...admin(), productControllers.listVendors);

module.exports = router;
