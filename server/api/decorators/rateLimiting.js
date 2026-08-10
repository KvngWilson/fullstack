/**
 * Rate Limiting Decorators
 * 
 * Composable decorators for rate limiting
 * Wraps rate limiter middleware for cleaner route definitions
 */

const { 
  authLimiter, 
  passwordResetLimiter, 
  apiLimiter, 
  generalLimiter 
} = require('../middleware/rateLimiter');

/**
 * Apply auth rate limiter (very strict)
 * @returns {Function[]} Middleware array
 * @example router.post('/login', ...rateAuth(), ...body(validateLogin), controller.login)
 */
function rateAuth() {
  return [authLimiter];
}

/**
 * Apply password reset rate limiter (extremely strict)
 * @returns {Function[]} Middleware array
 * @example router.post('/forgot-password', ...ratePasswordReset(), controller.forgot)
 */
function ratePasswordReset() {
  return [passwordResetLimiter];
}

/**
 * Apply API rate limiter (moderate)
 * @returns {Function[]} Middleware array
 * @example router.post('/orders', ...rateApi(), controller.create)
 */
function rateApi() {
  return [apiLimiter];
}

/**
 * Apply general rate limiter (lenient)
 * @returns {Function[]} Middleware array
 * @example router.get('/products', ...rateGeneral(), controller.list)
 */
function rateGeneral() {
  return [generalLimiter];
}

/**
 * Alias for rateApi (most common case)
 * @returns {Function[]} Middleware array
 */
const rateLimited = rateApi;

module.exports = {
  rateAuth,
  ratePasswordReset,
  rateApi,
  rateGeneral,
  rateLimited,
};
