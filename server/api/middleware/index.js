/**
 * Middleware Index
 * 
 * Centralized export of all API middleware
 * Organized by category for easy discovery
 */

// Authentication & Authorization
const auth = require('./auth');
const authorization = require('./authorization');
const rbac = require('./rbac');

// Validation
const validation = require('./validation');

// Error Handling
const error = require('./error');

// Security & Rate Limiting
const rateLimiter = require('./rateLimiter');

// Logging
const logger = require('./logger');

// Infrastructure (Phase 6)
const requestContext = require('./requestContext');
const metrics = require('./metrics');

// Export by category
module.exports = {
  // Authentication - Verify user identity
  auth: {
    authenticate: auth.authenticate,
    requireAuth: auth.requireAuth,
    requireVerified: auth.requireVerified,
    optionalAuth: auth.optionalAuth,
    attachUserId: auth.attachUserId,
  },
  
  // Authorization - User-level permissions (customers, admins)
  authorization: {
    requireRole: authorization.requireRole,
    requireAdmin: authorization.requireAdmin,
    requireCustomer: authorization.requireCustomer,
    requirePermission: authorization.requirePermission,
    requireAnyPermission: authorization.requireAnyPermission,
    requireAllPermissions: authorization.requireAllPermissions,
    requireOwnership: authorization.requireOwnership,
    requireTenantAccess: authorization.requireTenantAccess,
  },
  
  // RBAC - Employee-level permissions (staff, hierarchy, scopes)
  rbac: {
    PermissionChecker: rbac.PermissionChecker,
    requirePermission: rbac.requirePermission,
    requireAnyPermission: rbac.requireAnyPermission,
    requireAllPermissions: rbac.requireAllPermissions,
  },
  
  // Validation - Request validation using Joi
  validation: {
    validateBody: validation.validateBody,
    validateQuery: validation.validateQuery,
    validateParams: validation.validateParams,
    validate: validation.validate,
  },
  
  // Error Handling
  error: {
    errorHandler: error.errorHandler,
    notFoundHandler: error.notFoundHandler,
  },
  
  // Rate Limiting
  rateLimiter: {
    authLimiter: rateLimiter.authLimiter,
    passwordResetLimiter: rateLimiter.passwordResetLimiter,
    apiLimiter: rateLimiter.apiLimiter,
    generalLimiter: rateLimiter.generalLimiter,
  },
  
  // Logging
  logger: {
    requestLogger: logger.requestLogger,
    slowRequestLogger: logger.slowRequestLogger,
    errorLogger: logger.errorLogger,
  },
  
  // Request Context & Observability (Phase 6)
  requestContext: {
    correlationIdMiddleware: requestContext.correlationIdMiddleware,
    requestTimingMiddleware: requestContext.requestTimingMiddleware,
  },
  
  // Metrics & Monitoring (Phase 6)
  metrics: {
    metricsMiddleware: metrics.metricsMiddleware,
    metricsEndpoint: metrics.metricsEndpoint,
    getMetricsSnapshot: metrics.getMetricsSnapshot,
  },
};

// Also export individual modules for direct access
module.exports.authModule = auth;
module.exports.authorizationModule = authorization;
module.exports.rbacModule = rbac;
module.exports.validationModule = validation;
module.exports.errorModule = error;
module.exports.rateLimiterModule = rateLimiter;
module.exports.loggerModule = logger;
module.exports.requestContextModule = requestContext;
module.exports.metricsModule = metrics;
