/**
 * Admin Job Management Routes
 * Endpoints for managing background jobs
 * Restricted to root/super_admin only
 */

const express = require("express");
const router = express.Router();
const {
  getJobStatus,
  getSpecificJobStatus,
  triggerJob,
  refreshExchangeRatesManually,
} = require("../../../controllers/admin/jobsController");
const { protect, permission } = require("../../../decorators");
const PERMISSIONS = require("../../../../shared/constants/permissions");

// All routes require authentication
router.use(...protect());
router.use(...permission(PERMISSIONS.ADMIN.JOBS.MANAGE));

/**
 * @route   GET /api/v1/admin/jobs/status
 * @desc    Get status of all background jobs
 * @access  Root/Super Admin
 */
router.get("/status", getJobStatus);

/**
 * @route   GET /api/v1/admin/jobs/:jobName/status
 * @desc    Get status of specific job
 * @access  Root/Super Admin
 */
router.get("/:jobName/status", getSpecificJobStatus);

/**
 * @route   POST /api/v1/admin/jobs/:jobName/trigger
 * @desc    Manually trigger a job
 * @access  Root/Super Admin
 */
router.post("/:jobName/trigger", triggerJob);

/**
 * @route   POST /api/v1/admin/jobs/exchange-rates/refresh
 * @desc    Manually refresh exchange rates
 * @access  Root/Super Admin
 */
router.post("/exchange-rates/refresh", refreshExchangeRatesManually);

module.exports = router;
