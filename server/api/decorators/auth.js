/**
 * Authentication & Authorization Decorators
 * 
 * Composable decorators for common auth patterns
 * Wraps middleware for cleaner route definitions
 */

const { requireAuth, requireVerified, authenticate } = require('../middleware/auth');
const { 
  requireAdmin, 
  requireCustomer, 
  requireRole,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireOwnership,
} = require('../middleware/authorization');

/**
 * Require authenticated user
 * @returns {Function[]} Middleware array
 * @example router.get('/profile', ...protect(), controller.profile)
 */
function protect() {
  return [authenticate, requireAuth];
}

/**
 * Require authenticated and verified user
 * @returns {Function[]} Middleware array
 * @example router.post('/orders', ...verified(), controller.create)
 */
function verified() {
  return [authenticate, requireAuth, requireVerified];
}

/**
 * Require admin role
 * @returns {Function[]} Middleware array
 * @example router.delete('/users/:id', ...admin(), controller.delete)
 */
function admin() {
  return [authenticate, requireAuth, requireAdmin];
}

/**
 * Require customer role (or admin)
 * @returns {Function[]} Middleware array
 * @example router.post('/orders', ...customer(), controller.create)
 */
function customer() {
  return [authenticate, requireAuth, requireCustomer];
}

/**
 * Require specific role(s)
 * @param {...string} roles - Required roles
 * @returns {Function[]} Middleware array
 * @example router.get('/dashboard', ...role('admin', 'staff'), controller.dashboard)
 */
function role(...roles) {
  return [authenticate, requireAuth, requireRole(...roles)];
}

/**
 * Require specific permission
 * @param {string} permission - Required permission code
 * @returns {Function[]} Middleware array
 * @example router.post('/products', ...permission('products:create'), controller.create)
 */
function permission(permissionCode) {
  return [authenticate, requireAuth, requirePermission(permissionCode)];
}

/**
 * Require any of the specified permissions
 * @param {string[]} permissions - Array of permission codes
 * @returns {Function[]} Middleware array
 * @example router.get('/orders', ...anyPermission(['orders:view', 'orders:manage']), controller.list)
 */
function anyPermission(permissions) {
  return [authenticate, requireAuth, requireAnyPermission(permissions)];
}

/**
 * Require all specified permissions
 * @param {string[]} permissions - Array of permission codes
 * @returns {Function[]} Middleware array
 * @example router.post('/refund', ...allPermissions(['orders:manage', 'payments:refund']), controller.refund)
 */
function allPermissions(permissions) {
  return [authenticate, requireAuth, requireAllPermissions(permissions)];
}

/**
 * Require resource ownership (users can only access their own resources)
 * @param {Object} options - Options object
 * @param {Function} options.getResource - Function to fetch resource
 * @returns {Function[]} Middleware array
 * @example 
 * router.put('/orders/:id', 
 *   ...ownership({ getResource: async (req) => getOrder(req.params.id) }),
 *   controller.update
 * )
 */
function ownership(options) {
  return [authenticate, requireAuth, requireOwnership(options)];
}

/**
 * Optional authentication (non-blocking)
 * @returns {Function[]} Middleware array
 * @example router.get('/products', ...optional(), controller.list)
 */
function optional() {
  return [authenticate];
}

module.exports = {
  protect,
  verified,
  admin,
  customer,
  role,
  permission,
  anyPermission,
  allPermissions,
  ownership,
  optional,
};
