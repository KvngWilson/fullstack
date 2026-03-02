const router = require("express").Router();

function normalizeRouter(candidate) {
	if (typeof candidate === "function") {
		return candidate;
	}
	return require("express").Router();
}

router.use("/", normalizeRouter(require("./admin")));
router.use("/analytics", normalizeRouter(require("./analytics")));
router.use("/content", normalizeRouter(require("./content")));

module.exports = router;
