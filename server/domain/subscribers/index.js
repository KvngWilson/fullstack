const eventDispatcher = require("../shared/events/dispatcher");
const { registerCatalogSubscribers } = require("../catalog/subscribers");
const { registerShippingSubscribers } = require("../shipping/subscribers");

let initialized = false;

function registerDomainSubscribers() {
  if (initialized) {
    return;
  }

  registerCatalogSubscribers(eventDispatcher);
  registerShippingSubscribers(eventDispatcher);

  initialized = true;
}

module.exports = {
  registerDomainSubscribers,
};
