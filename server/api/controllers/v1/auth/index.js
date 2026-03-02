/**
 * Auth Domain Controllers
 * Exports all authentication-related controllers
 */

const auth = require("./auth");
const authPlatform = require("./auth-platform");
const enhancedAuth = require("./enhanced-auth");

module.exports = {
  auth,
  authPlatform,
  enhancedAuth,
};
