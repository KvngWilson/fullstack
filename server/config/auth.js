const jwt = require("jsonwebtoken");
const { errorResponse } = require("../shared/utils/response");

const JWT_SECRET = process.env.JWT_SECRET; // No fallback - will fail env validation
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

// Generate JWT token
function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware to protect routes - requires valid JWT
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader) {
    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return errorResponse(res, {
        message: "Invalid token format. Use: Bearer <token>",
        status: 401,
      });
    }

    token = parts[1];
  } else {
    token = req.cookies?.token || req.cookies?.access_token || null;
  }

  if (!token) {
    return errorResponse(res, { message: "No token provided", status: 401 });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return errorResponse(res, {
      message: "Invalid or expired token",
      status: 401,
    });
  }

  req.user = decoded;
  next();
}



// Single module.exports (no mixing)
module.exports = {
  generateToken,
  verifyToken,
  authenticateJWT,
};