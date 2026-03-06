const logger = require("../../../shared/utils/logger");

let subscribersRegistered = false;

function registerShippingSubscribers(eventDispatcher) {
  if (subscribersRegistered) {
    return;
  }

  eventDispatcher.subscribe("payment.succeeded", async (event) => {
    logger.info("Shipping subscriber received payment.succeeded", {
      eventType: event.eventType || event.type,
      paymentId: event.paymentId,
      orderId: event.orderId,
      userId: event.userId,
    });
  });

  subscribersRegistered = true;
}

module.exports = {
  registerShippingSubscribers,
};
