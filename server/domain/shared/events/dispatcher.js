const EventBus = require("./EventBus");

const eventBus = new EventBus();

async function publish(event) {
  if (!event) {
    throw new Error("Invalid event");
  }

  if (!event.eventType && event.type) {
    event.eventType = event.type;
  }

  return eventBus.publish(event);
}

function subscribe(eventType, handler) {
  return eventBus.subscribe(eventType, handler);
}

function publishAll(events = []) {
  return eventBus.publishAll(events);
}

function getDeadLetterQueue() {
  return eventBus.getDeadLetterQueue();
}

function clear() {
  return eventBus.clear();
}

module.exports = {
  eventBus,
  publish,
  subscribe,
  publishAll,
  getDeadLetterQueue,
  clear,
};
