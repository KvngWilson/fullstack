/**
 * Shared domain exports
 *
 * These are the core DDD building blocks used across all domain modules.
 * Import from this index for clean, centralized imports.
 */

// Entities
const AggregateRoot = require("./entities/AggregateRoot");

// Events
const DomainEvent = require("./events/DomainEvent");
const EventBus = require("./events/EventBus");
const eventDispatcher = require("./events/dispatcher");

// Repositories
const BaseRepository = require("./repositories/BaseRepository");

// Exceptions
const DomainException = require("./exceptions/DomainException");
const ValidationException = require("./exceptions/ValidationException");
const EntityNotFoundException = require("./exceptions/EntityNotFoundException");

module.exports = {
  // Entities
  AggregateRoot,

  // Events
  DomainEvent,
  EventBus,
  eventDispatcher,

  // Repositories
  BaseRepository,

  // Exceptions
  DomainException,
  ValidationException,
  EntityNotFoundException,
};
