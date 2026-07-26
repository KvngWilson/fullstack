/**
 * Extracts the JWT token from the request (Authorization header or cookies).
 * Returns the token string or null if not found.
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }
  return req.cookies?.token || req.cookies?.access_token || null;
}

module.exports = extractToken;
