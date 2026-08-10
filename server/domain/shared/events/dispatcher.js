/**
 * Event Dispatcher
 *
 * Thin facade over the active event bus transport.
 * Default transport: in-memory EventBus (no external dependencies).
 * Production transport: RabbitMQEventBus (swap via dispatcher.init()).
 *
 * Domain services call publish/subscribe without knowing which transport
 * is active — the dispatcher selects the right one at startup.
 */

const EventBus = require("./EventBus");
const { logger } = require("../../../shared/utils/logger");

let _bus = new EventBus(); // default: in-memory

/**
 * Replace the active transport.
 * Call this once during application bootstrap when RABBITMQ_URL is set.
 * Subscribers registered before init() are NOT migrated; init() should
 * be called before registerDomainSubscribers().
 *
 * @param {object} transport - Any object with publish/publishAll/subscribe/getDeadLetterQueue/clear
 */
function init(transport) {
  if (!transport || typeof transport.publish !== "function") {
    throw new Error("transport must implement publish()");
  }
  _bus = transport;
  logger.info("EventBus transport initialized", {
    transport: transport.constructor?.name ?? "unknown",
  });
}

async function publish(event) {
  if (!event) {
    throw new Error("Invalid event");
  }
  if (!event.eventType && event.type) {
    event.eventType = event.type;
  }
  return _bus.publish(event);
}

async function subscribe(eventType, handler, queueName) {
  return _bus.subscribe(eventType, handler, queueName);
}

async function publishAll(events = []) {
  return _bus.publishAll(events);
}

function getDeadLetterQueue() {
  return _bus.getDeadLetterQueue();
}

function clear() {
  return _bus.clear();
}

module.exports = {
  init,
  get eventBus() {
    return _bus;
  },
  publish,
  subscribe,
  publishAll,
  getDeadLetterQueue,
  clear,
};
