/**
 * Identity Domain Routes
 * Aggregates user management, authentication, and staff management
 */

const express = require("express");
const router = express.Router();

const profileRoutes = require("./profile");
const employeesRoutes = require("./employees");
const onboardingRoutes = require("./onboarding");

// User profile management
router.use("/profile", profileRoutes);

// Employee/staff management
router.use("/employees", employeesRoutes);

// Employee onboarding plans
router.use("/onboarding", onboardingRoutes);

module.exports = router;
