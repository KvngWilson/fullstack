/**
 * Security Infrastructure Module
 *
 * NOTE: Token management has been consolidated into AuthenticationService.
 * This module is deprecated. Use AuthenticationService from domain/identity/services instead.
 */

// Deprecated - Use AuthenticationService instead
const tokenManager = require('./tokenManager');

module.exports = {
  tokenManager, // DEPRECATED
};
