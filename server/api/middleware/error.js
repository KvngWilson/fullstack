const { AppError } = require("../../shared/utils/errors");
const logger = require("../..//shared/utils/logger");

// Centralized error handling middleware
function errorHandler(err, req, res, next) {
  // Log error
  logger.error("Error", {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Operational errors (known errors)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Programming errors or unknown errors
  if (process.env.NODE_ENV === "development") {
    return res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack,
    });
  }

  // Production: Don't leak error details
  return res.status(500).json({
    success: false,
    error: "An unexpected error occurred",
  });
}

// 404 handler for unmatched routes
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
