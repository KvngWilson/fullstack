const logger = require("../../../shared/utils/logger");
const { fireAndForgetWithErrorLog } = require("../../../shared/utils/asyncErrorHandler");

let subscribersRegistered = false;

function registerShippingSubscribers(eventDispatcher) {
  if (subscribersRegistered) {
    return;
  }

  eventDispatcher.subscribe("payment.succeeded", async (event) => {
    await fireAndForgetWithErrorLog(
      async () => {
        logger.info("Shipping subscriber received payment.succeeded", {
          eventType: event.eventType || event.type,
          paymentId: event.paymentId,
          orderId: event.orderId,
          userId: event.userId,
        });
      },
      {
        service: "ShippingSubscriber",
        operation: "handlePaymentSucceeded",
        context: { paymentId: event.paymentId, orderId: event.orderId },
        severity: "warn"
      }
    );
  });

  subscribersRegistered = true;
}

module.exports = {
  registerShippingSubscribers,
};
