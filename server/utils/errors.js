/**
 * Custom application errors
 */

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguish from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400);
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    if (typeof resource === "string" && /not found$/i.test(resource.trim())) {
      super(resource, 404);
      return;
    }

    super(`${resource} not found`, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

class InvalidOrderError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class InsufficientStockError extends AppError {
  constructor(message) {
    super(message, 409); // Conflict
  }
}

class PaymentError extends AppError {
  constructor(message) {
    super(message, 402); // Payment Required
  }
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function handleDatabaseError(dbError = {}) {
  switch (dbError.code) {
    case "23505":
      return new ConflictError(dbError.detail || "Resource already exists");
    case "23503":
      return new ValidationError("Invalid reference");
    case "23502":
      return new ValidationError(
        `${dbError.column || "Required field"} cannot be null`,
      );
    default:
      return new AppError("Database error occurred", 500);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  InvalidOrderError,
  InsufficientStockError,
  PaymentError,
  asyncHandler,
  handleDatabaseError,
};
