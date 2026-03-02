const DomainException = require('./DomainException');

/**
 * EntityNotFoundException - Raised when requested entity doesn't exist
 */
class EntityNotFoundException extends DomainException {
  constructor(entityName, identifier) {
    super(
      `${entityName} with ID ${identifier} not found`,
      'ENTITY_NOT_FOUND',
      404,
      { entityName, identifier }
    );
  }
}

module.exports = EntityNotFoundException;
