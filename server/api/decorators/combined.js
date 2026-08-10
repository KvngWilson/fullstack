/**
 * Combined/Composite Decorators
 * 
 * Pre-composed decorator combinations for common scenarios
 * Combines auth, validation, rate limiting, and caching
 */

const auth = require('./auth');
const validation = require('./validation');
const rateLimiting = require('./rateLimiting');
const caching = require('./caching');

/**
 * Protected route with validation
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example 
 * router.post('/orders', 
 *   ...protectedValidated(validateCreateOrder),
 *   controller.create
 * )
 */
function protectedValidated(validator) {
  return [
    ...auth.protect(),
    ...validation.body(validator),
  ];
}

/**
 * Admin route with validation
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example 
 * router.post('/products', 
 *   ...adminValidated(validateCreateProduct),
 *   controller.create
 * )
 */
function adminValidated(validator) {
  return [
    ...auth.admin(),
    ...validation.body(validator),
  ];
}

/**
 * Customer route with validation
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example 
 * router.post('/orders', 
 *   ...customerValidated(validateCreateOrder),
 *   controller.create
 * )
 */
function customerValidated(validator) {
  return [
    ...auth.customer(),
    ...validation.body(validator),
  ];
}

/**
 * Verified user route with validation
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example 
 * router.post('/premium-order', 
 *   ...verifiedValidated(validatePremiumOrder),
 *   controller.create
 * )
 */
function verifiedValidated(validator) {
  return [
    ...auth.verified(),
    ...validation.body(validator),
  ];
}

/**
 * Protected route with query validation and caching
 * @param {Function} validator - Joi validator function
 * @param {Object} cacheOptions - Caching options
 * @returns {Function[]} Middleware array
 * @example 
 * router.get('/orders', 
 *   ...protectedCached(validateOrdersListQuery, { ttl: 60 }),
 *   controller.list
 * )
 */
function protectedCached(validator, cacheOptions = {}) {
  return [
    ...auth.protect(),
    ...validation.query(validator),
    ...caching.cache(cacheOptions),
  ];
}

/**
 * Public route with caching
 * @param {Object} cacheOptions - Caching options
 * @returns {Function[]} Middleware array
 * @example 
 * router.get('/products', 
 *   ...publicCached({ ttl: 300 }),
 *   controller.list
 * )
 */
function publicCached(cacheOptions = {}) {
  return [
    ...caching.cache(cacheOptions),
  ];
}

/**
 * Auth route (login, register) with rate limiting and validation
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example 
 * router.post('/login', 
 *   ...authRoute(validateLogin),
 *   controller.login
 * )
 */
function authRoute(validator) {
  return [
    ...rateLimiting.rateAuth(),
    ...validation.body(validator),
  ];
}

/**
 * Password reset route with strict rate limiting and validation
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example 
 * router.post('/forgot-password', 
 *   ...passwordResetRoute(validateForgotPassword),
 *   controller.forgot
 * )
 */
function passwordResetRoute(validator) {
  return [
    ...rateLimiting.ratePasswordReset(),
    ...validation.body(validator),
  ];
}

/**
 * Standard API route with protection, rate limiting, and validation
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example 
 * router.post('/orders', 
 *   ...apiRoute(validateCreateOrder),
 *   controller.create
 * )
 */
function apiRoute(validator) {
  return [
    ...auth.protect(),
    ...rateLimiting.rateApi(),
    ...validation.body(validator),
  ];
}

/**
 * List route with auth, query validation, and caching
 * @param {Function} validator - Joi validator function for query params
 * @param {Object} cacheOptions - Caching options
 * @returns {Function[]} Middleware array
 * @example 
 * router.get('/orders', 
 *   ...listRoute(validateOrdersListQuery, { ttl: 60 }),
 *   controller.list
 * )
 */
function listRoute(validator, cacheOptions = {}) {
  return [
    ...auth.protect(),
    ...validation.query(validator),
    ...caching.cacheUser({ ttl: 60, ...cacheOptions }),
  ];
}

/**
 * Create route with admin access and validation
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example 
 * router.post('/products', 
 *   ...createRoute(validateCreateProduct),
 *   controller.create
 * )
 */
function createRoute(validator) {
  return [
    ...auth.admin(),
    ...rateLimiting.rateApi(),
    ...validation.body(validator),
  ];
}

/**
 * Update route with ownership check and validation
 * @param {Function} validator - Joi validator function
 * @param {Object} ownershipOptions - Ownership check options
 * @returns {Function[]} Middleware array
 * @example 
 * router.put('/orders/:id', 
 *   ...updateRoute(validateUpdateOrder, { 
 *     getResource: async (req) => getOrder(req.params.id) 
 *   }),
 *   controller.update
 * )
 */
function updateRoute(validator, ownershipOptions) {
  return [
    ...auth.ownership(ownershipOptions),
    ...validation.body(validator),
  ];
}

/**
 * Delete route with admin access
 * @returns {Function[]} Middleware array
 * @example 
 * router.delete('/products/:id', 
 *   ...deleteRoute(),
 *   controller.delete
 * )
 */
function deleteRoute() {
  return [
    ...auth.admin(),
    ...rateLimiting.rateApi(),
  ];
}

/**
 * Get single resource route with auth and caching
 * @param {Object} cacheOptions - Caching options
 * @returns {Function[]} Middleware array
 * @example 
 * router.get('/products/:id', 
 *   ...getRoute({ ttl: 300 }),
 *   controller.get
 * )
 */
function getRoute(cacheOptions = {}) {
  return [
    ...auth.optional(),
    ...caching.cache({ ttl: 300, ...cacheOptions }),
  ];
}

module.exports = {
  // Auth + Validation combos
  protectedValidated,
  adminValidated,
  customerValidated,
  verifiedValidated,
  
  // Caching combos
  protectedCached,
  publicCached,
  
  // Rate limiting combos
  authRoute,
  passwordResetRoute,
  
  // Full stack combos
  apiRoute,
  listRoute,
  createRoute,
  updateRoute,
  deleteRoute,
  getRoute,
};
