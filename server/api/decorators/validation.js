/**
 * Validation Decorators
 * 
 * Composable decorators for request validation
 * Wraps validation middleware for cleaner route definitions
 */

const { 
  validateBody, 
  validateQuery, 
  validateParams, 
  validate 
} = require('../middleware/validation');

/**
 * Validate request body
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example 
 * const { validateLogin } = require('../validators/auth');
 * router.post('/login', ...body(validateLogin), controller.login)
 */
function body(validator) {
  return [validateBody(validator)];
}

/**
 * Validate query parameters
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example 
 * const { validateOrdersListQuery } = require('../validators/order');
 * router.get('/orders', ...query(validateOrdersListQuery), controller.list)
 */
function query(validator) {
  return [validateQuery(validator)];
}

/**
 * Validate route parameters
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example router.get('/orders/:id', ...params(validateIdParam), controller.get)
 */
function params(validator) {
  return [validateParams(validator)];
}

/**
 * Validate multiple parts of request
 * @param {Object} validators - Object with body, query, and/or params validators
 * @returns {Function[]} Middleware array
 * @example 
 * router.post('/orders', 
 *   ...all({ body: validateCreateOrder, query: validatePagination }),
 *   controller.create
 * )
 */
function all(validators) {
  return [validate(validators)];
}

/**
 * Shorthand for body validation (most common case)
 * @param {Function} validator - Joi validator function
 * @returns {Function[]} Middleware array
 * @example router.post('/login', ...validated(validateLogin), controller.login)
 */
const validated = body;

module.exports = {
  body,
  query,
  params,
  all,
  validated,
};
