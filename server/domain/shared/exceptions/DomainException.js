/**
 * DomainException - Base class for domain-level exceptions
 * 
 * Domain exceptions represent business logic violations,
 * constraint breaches, and domain rule violations.
 * They are distinct from infrastructure errors.
 * 
 * Examples:
 * - InsufficientInventoryException
 * - InvalidOrderStateException
 * - UnauthorizedAccessException
 */
class DomainException extends Error {
  constructor(message, code = 'DOMAIN_ERROR', statusCode = 400, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert exception to response object
   */
  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  /**
   * Check if this is a domain exception
   */
  isDomainException() {
    return true;
  }
}

module.exports = DomainException;
