const jwt = require("jsonwebtoken");
const passport = require("./passport");

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      role: user.role 
    },
    process.env.JWT_SECRET || "jwt-secret-key",
    { expiresIn: "24h" }
  );
};

// Middleware to authenticate JWT using Passport
const authenticateJWT = passport.authenticate("jwt", { session: false });

// Middleware to check if user has required role
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
};

// Middleware to require admin role
const requireAdmin = requireRole("admin");

// Middleware to require customer or admin
const requireCustomer = requireRole("customer", "admin");

module.exports = {
  generateToken,
  authenticateJWT,
  requireRole,
  requireAdmin,
  requireCustomer,
};