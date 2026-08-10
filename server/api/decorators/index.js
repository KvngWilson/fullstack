/**
 * API Route Decorators
 * 
 * Centralized export of all route decorators
 * Provides composable middleware patterns for cleaner route definitions
 * 
 * @example
 * const { protect, body, admin } = require('./decorators');
 * 
 * router.post('/orders',
 *   ...protect(),
 *   ...body(validateCreateOrder),
 *   controller.create
 * );
 */

// Import all decorator modules
const auth = require('./auth');
const validation = require('./validation');
const caching = require('./caching');
const rateLimiting = require('./rateLimiting');
const combined = require('./combined');

// Export all decorators organized by category
module.exports = {
  // Authentication & Authorization
  ...auth,
  
  // Validation
  ...validation,
  
  // Caching
  ...caching,
  
  // Rate Limiting
  ...rateLimiting,
  
  // Combined/Composite
  ...combined,
  
  // Also export by category for organized access
  auth,
  validation,
  caching,
  rateLimiting,
  combined,
};
