const express = require("express");
const { admin } = require("../../../decorators");
const { withAdminAssetUpload } = require("../../../middleware/adminAssetUpload");
const uploadControllers = require("../../../controllers/v1/admin/uploads");

const router = express.Router();

router.post("/", ...admin(), withAdminAssetUpload, uploadControllers.uploadAssets);

module.exports = router;
