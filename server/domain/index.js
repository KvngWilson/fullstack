/**
 * Domain Layer - All Business Logic
 * 
 * This layer contains:
 * - Domain Entities (Aggregates)
 * - Domain Services
 * - Repositories (interfaces only)
 * - Domain Events
 * - Value Objects
 * - Domain Policies
 * - Domain Exceptions
 * 
 * Key Principles:
 * 1. No infrastructure imports (no DB, API, cache libraries)
 * 2. Domain rules are enforced here
 * 3. Services are thin (orchestration only)
 * 4. Repositories abstract data access
 * 5. Events represent significant business events
 * 
 * Import Path: const { AggregateRoot, DomainEvent } = require('./shared')
 */

const sharedDomain = require('./shared');

const identity = require('./identity');
const catalog = require('./catalog');
const ordering = require('./ordering');
const payment = require('./payment');
const shipping = require('./shipping');
const vendor = require('./vendor');

module.exports = {
  // Shared DDD primitives
  shared: sharedDomain,

  // Domain modules
  identity,
  catalog,
  ordering,
  payment,
  shipping,
  vendor,
};
