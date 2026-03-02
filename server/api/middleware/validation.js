/**
 * Validation Middleware
 * 
 * Provides middleware functions for validating request body, query, and params
 * using Joi validator functions from api/validators/
 * 
 * @example
 * const { validateLogin } = require('../validators/auth');
 * router.post('/login', validateBody(validateLogin), controller.login);
 */

/**
 * Create validation middleware for request body
 * @param {Function} validator - Joi validator function from api/validators
 * @returns {Function} Express middleware
 */
function validateBody(validator) {
	return (req, res, next) => {
		if (typeof validator !== "function") {
			return res.status(500).json({ 
				success: false,
				error: "Validation configuration error" 
			});
		}

		const { value, error } = validator(req.body || {});
		if (error) {
			return res.status(400).json({
				success: false,
				error: error.details?.[0]?.message || "Invalid request body",
				details: error.details?.map(d => ({
					field: d.path.join('.'),
					message: d.message
				}))
			});
		}

		// Replace body with validated/sanitized value
		req.body = value;
		return next();
	};
}

/**
 * Create validation middleware for query parameters
 * @param {Function} validator - Joi validator function
 * @returns {Function} Express middleware
 */
function validateQuery(validator) {
	return (req, res, next) => {
		if (typeof validator !== "function") {
			return res.status(500).json({ 
				success: false,
				error: "Validation configuration error" 
			});
		}

		const { value, error } = validator(req.query || {});
		if (error) {
			return res.status(400).json({
				success: false,
				error: error.details?.[0]?.message || "Invalid query parameters",
				details: error.details?.map(d => ({
					field: d.path.join('.'),
					message: d.message
				}))
			});
		}

		// Replace query with validated/sanitized value
		req.query = value;
		return next();
	};
}

/**
 * Create validation middleware for route parameters
 * @param {Function} validator - Joi validator function
 * @returns {Function} Express middleware
 */
function validateParams(validator) {
	return (req, res, next) => {
		if (typeof validator !== "function") {
			return res.status(500).json({ 
				success: false,
				error: "Validation configuration error" 
			});
		}

		const { value, error } = validator(req.params || {});
		if (error) {
			return res.status(400).json({
				success: false,
				error: error.details?.[0]?.message || "Invalid route parameters",
				details: error.details?.map(d => ({
					field: d.path.join('.'),
					message: d.message
				}))
			});
		}

		// Replace params with validated/sanitized value
		req.params = value;
		return next();
	};
}

/**
 * Create validation middleware that validates multiple request parts
 * @param {Object} validators - Object with body, query, and/or params validator functions
 * @returns {Function} Express middleware
 * @example
 * validate({ body: validateCreateOrder, query: validatePagination })
 */
function validate(validators) {
	return (req, res, next) => {
		const errors = [];

		// Validate body
		if (validators.body) {
			const { value, error } = validators.body(req.body || {});
			if (error) {
				errors.push(...error.details.map(d => ({
					location: 'body',
					field: d.path.join('.'),
					message: d.message
				})));
			} else {
				req.body = value;
			}
		}

		// Validate query
		if (validators.query) {
			const { value, error } = validators.query(req.query || {});
			if (error) {
				errors.push(...error.details.map(d => ({
					location: 'query',
					field: d.path.join('.'),
					message: d.message
				})));
			} else {
				req.query = value;
			}
		}

		// Validate params
		if (validators.params) {
			const { value, error } = validators.params(req.params || {});
			if (error) {
				errors.push(...error.details.map(d => ({
					location: 'params',
					field: d.path.join('.'),
					message: d.message
				})));
			} else {
				req.params = value;
			}
		}

		// Return errors if any
		if (errors.length > 0) {
			return res.status(400).json({
				success: false,
				error: "Validation failed",
				details: errors
			});
		}

		return next();
	};
}

module.exports = {
	validateBody,
	validateQuery,
	validateParams,
	validate,
};
