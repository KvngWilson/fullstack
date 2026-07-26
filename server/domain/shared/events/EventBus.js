/**
 * EventBus - Mediates publish/subscribe of domain events
 *
 * Pattern: Event-driven architecture
 * - Publishers don't know subscribers
 * - Subscribers register as handlers
 * - Decouples domains
 *
 * In-memory implementation backed by Node's EventEmitter.
 * All events are dispatched synchronously within the same process.
 * Can be replaced with a message broker (Kafka, RabbitMQ) by swapping
 * this module without touching callers.
 */

const { EventEmitter } = require("events");
const { logger } = require("../../../shared/utils/logger");

class EventBus {
  constructor() {
    this._emitter = new EventEmitter();
    this._emitter.setMaxListeners(50); // allow many subscribers per event type
    this._deadLetterQueue = [];
    this._subscribers = new Map(); // eventType → Set of handlers (for clear/inspection)
  }

  /**
   * Subscribe a handler to an event type.
   * @param {string} eventType
   * @param {Function} handler  async (event) => void
   */
  subscribe(eventType, handler) {
    if (typeof eventType !== "string" || !eventType) {
      throw new Error("eventType must be a non-empty string");
    }
    if (typeof handler !== "function") {
      throw new Error("handler must be a function");
    }

    this._emitter.on(eventType, handler);

    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, new Set());
    }
    this._subscribers.get(eventType).add(handler);
  }

  /**
   * Publish a single domain event.
   * All registered handlers are called in registration order.
   * Handler errors are caught, logged, and pushed to the dead-letter queue
   * so one failing handler cannot block others.
   * @param {object} event  Must have eventType or type property
   */
  async publish(event) {
    if (!event || typeof event !== "object") {
      throw new Error("event must be a non-null object");
    }

    const eventType = event.eventType || event.type;
    if (!eventType) {
      throw new Error("event must have an eventType or type property");
    }

    const handlers = this._emitter.listeners(eventType);
    if (handlers.length === 0) {
      logger.debug("EventBus: no subscribers for event", { eventType });
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error("EventBus: handler error", {
          eventType,
          error: error.message,
          stack: error.stack,
        });
        this._deadLetterQueue.push({ event, error: error.message, failedAt: new Date() });
      }
    }
  }

  /**
   * Publish multiple domain events in order.
   * @param {object[]} events
   */
  async publishAll(events = []) {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Return events that could not be delivered due to handler errors.
   * @returns {Array<{event, error, failedAt}>}
   */
  getDeadLetterQueue() {
    return this._deadLetterQueue;
  }

  /**
   * Return subscribers for a given event type.
   * Used by tests to verify idempotent subscriber registration.
   * @param {string} eventType
   * @returns {Function[]}
   */
  getSubscribers(eventType) {
    return Array.from(this._subscribers.get(eventType) || []);
  }

  /**
   * Remove all subscribers and clear the dead-letter queue.
   * Primarily used in tests.
   */
  clear() {
    this._emitter.removeAllListeners();
    this._subscribers.clear();
    this._deadLetterQueue = [];
  }
}

module.exports = EventBus;
