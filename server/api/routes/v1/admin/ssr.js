const express = require("express");
const { protect } = require("../../../decorators");
const ssrControllers = require("../../../controllers/v1/admin/ssr");

const router = express.Router();

/**
 * Admin SSR Routes
 * Server-side rendering and hydration for admin pages
 */

router.use(...protect());

// Validate admin page access and return hydration payload
router.get(
  "/validate-access",
  ssrControllers.validateAdminPageAccess,
  ssrControllers.getSSRHydrationData,
);

// GET /api/v1/admin/ssr/dashboard - Dashboard data
router.get("/dashboard", ssrControllers.getAdminDashboardData);

// GET /api/v1/admin/ssr/hydration - Get SSR hydration data
router.get("/hydration", ssrControllers.getSSRHydrationData);

// POST /api/v1/admin/ssr/validate-resource - Validate resource access
router.post("/validate-resource", ssrControllers.validateResourceAccess);

// GET /api/v1/admin/ssr/ui-config - Get UI configuration
router.get("/ui-config", ssrControllers.getAdminUIConfig);

module.exports = router;
