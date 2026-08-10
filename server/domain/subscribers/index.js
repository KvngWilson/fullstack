const eventDispatcher = require("../shared/events/dispatcher");
const { registerCatalogSubscribers } = require("../catalog/subscribers");
const { registerShippingSubscribers } = require("../shipping/subscribers");
const OrderStatusChangedSubscriber = require("./OrderStatusChangedSubscriber");

let initialized = false;
let orderStatusSubscriberRegistered = false;

function registerDomainSubscribers({ websocketManager } = {}) {
  if (initialized) {
    if (websocketManager && !orderStatusSubscriberRegistered) {
      const subscriber = new OrderStatusChangedSubscriber(websocketManager);
      eventDispatcher.subscribe("ordering.order.status.changed", (event) =>
        subscriber.handle(event),
      );
      orderStatusSubscriberRegistered = true;
    }
    return;
  }

  registerCatalogSubscribers(eventDispatcher);
  registerShippingSubscribers(eventDispatcher);
  initialized = true;

  if (websocketManager && !orderStatusSubscriberRegistered) {
    const subscriber = new OrderStatusChangedSubscriber(websocketManager);
    eventDispatcher.subscribe("ordering.order.status.changed", (event) =>
      subscriber.handle(event),
    );
    orderStatusSubscriberRegistered = true;
  }
}

module.exports = {
  registerDomainSubscribers,
};
