/**
 * Custom application errors
 */

/**
 * Base operational error for application-level failures.
 * Carries HTTP status and operational marker.
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

/**
 * Validation error for invalid request or domain input.
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400);
    this.details = details;
  }
}

/**
 * Authentication error for identity verification failures.
 */
class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401);
  }
}

/**
 * Authorization error for forbidden actions.
 */
class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}

/**
 * Not-found error for missing resources.
 */
class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    if (typeof resource === "string" && /not found$/i.test(resource.trim())) {
      super(resource, 404);
      return;
    }

    super(`${resource} not found`, 404);
  }
}

/**
 * Conflict error for state collisions and duplicates.
 */
class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

/**
 * Order validation error for invalid order flows.
 */
class InvalidOrderError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

/**
 * Stock error for insufficient inventory conditions.
 */
class InsufficientStockError extends AppError {
  constructor(message) {
    super(message, 409); // Conflict
  }
}

/**
 * Payment error for charge and settlement failures.
 */
class PaymentError extends AppError {
  constructor(message) {
    super(message, 402); // Payment Required
  }
}

/**
 * Shipping validation error for invalid shipment requests.
 */
class InvalidShippingRequest extends AppError {
  constructor(message) {
    super(message, 400); // Bad Request
  }
}

/**
 * Upstream service error for dependency failures.
 */
class ExternalServiceError extends AppError {
  constructor(message) {
    super(message, 502); // Bad Gateway
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
  InvalidShippingRequest,
  ExternalServiceError,
  asyncHandler,
  handleDatabaseError,
};
