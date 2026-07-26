/**
 * Auth Domain Controllers
 * Exports all authentication-related controllers
 */

const authPlatform = require("./auth-platform");
const enhancedAuth = require("./enhanced-auth");
const adminAuth = require("./admin-auth");

module.exports = {
  authPlatform,
  enhancedAuth,
  adminAuth,
};
