const DomainException = require('./DomainException');

/**
 * ValidationException - Raised when domain invariants are violated
 */
class ValidationException extends DomainException {
  constructor(message, details = {}) {
    super(
      message,
      'VALIDATION_ERROR',
      422, // Unprocessable Entity
      details
    );
  }
}

module.exports = ValidationException;
