const logger = require("../../../shared/utils/logger");
const {
  fireAndForgetWithErrorLog,
} = require("../../../shared/utils/asyncErrorHandler");

let subscribersRegistered = false;

function registerCatalogSubscribers(eventDispatcher) {
  if (subscribersRegistered) {
    return;
  }

  eventDispatcher.subscribe("catalog.product.created", async (event) => {
    await fireAndForgetWithErrorLog(
      async () => {
        logger.info("Catalog product created event handled", {
          eventType: event.eventType || event.type,
          productId: event.productId,
          categoryId: event.categoryId,
        });
      },
      {
        service: "CatalogSubscriber",
        operation: "handleProductCreated",
        context: {
          eventType: event.eventType || event.type,
          productId: event.productId,
        },
        severity: "warn",
      },
    );
  });

  subscribersRegistered = true;
}

module.exports = {
  registerCatalogSubscribers,
};
