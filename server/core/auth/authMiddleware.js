const verifyToken = require('./verifyToken');
const extractToken = require('./extractUser');
const { errorResponse } = require('../../shared/utils/response');

/**
 * Auth middleware: verifies JWT, injects req.user, handles errors.
 * Returns 401/403 as appropriate.
 */
async function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return errorResponse(res, { message: 'No token provided', status: 401 });
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return errorResponse(res, { message: 'Invalid or expired token', status: 401 });
  }

  req.user = decoded;
  return next();
}

module.exports = authMiddleware;
