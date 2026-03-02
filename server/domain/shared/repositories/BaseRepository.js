/**
 * BaseRepository - Interface for all domain repositories
 * 
 * Repositories are responsible for:
 * - Abstracting data access logic
 * - Working with aggregates, not entities
 * - Enforcing transaction boundaries
 * - Implementing domain-specific queries
 * 
 * In DDD:
 * - One repo per aggregate root
 * - Domain services call repo methods
 * - Repos delegate to ORM/data layer
 */
class BaseRepository {
  /**
   * Get aggregate by ID
   * @param {*} id - Aggregate ID
   * @returns {Promise<AggregateRoot|null>}
   */
  async findById(id) {
    throw new Error('findById() must be implemented by subclass');
  }

  /**
   * Get all aggregates
   * @returns {Promise<AggregateRoot[]>}
   */
  async findAll() {
    throw new Error('findAll() must be implemented by subclass');
  }

  /**
   * Save aggregate (insert or update)
   * @param {AggregateRoot} aggregate
   * @returns {Promise<AggregateRoot>}
   */
  async save(aggregate) {
    throw new Error('save() must be implemented by subclass');
  }

  /**
   * Delete aggregate
   * @param {*} id - Aggregate ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('delete() must be implemented by subclass');
  }

  /**
   * Find by query specification
   * @param {Object} spec - Query specification
   * @returns {Promise<AggregateRoot[]>}
   */
  async findBySpec(spec) {
    throw new Error('findBySpec() must be implemented by subclass');
  }

  /**
   * Count aggregates matching spec
   * @param {Object} spec - Query specification
   * @returns {Promise<number>}
   */
  async count(spec = {}) {
    throw new Error('count() must be implemented by subclass');
  }

  /**
   * Check if aggregate exists
   * @param {*} id - Aggregate ID
   * @returns {Promise<boolean>}
   */
  async exists(id) {
    throw new Error('exists() must be implemented by subclass');
  }
}

module.exports = BaseRepository;
