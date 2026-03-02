/**
 * Identity Domain Routes
 * Aggregates user management, authentication, and staff management
 */

const express = require("express");
const router = express.Router();

const userRoutes = require("./user");
const profileRoutes = require("./profile");
const employeesRoutes = require("./employees");

// User registration and authentication
router.use("/", userRoutes);

// User profile management
router.use("/profile", profileRoutes);

// Employee/staff management
router.use("/employees", employeesRoutes);

module.exports = router;
