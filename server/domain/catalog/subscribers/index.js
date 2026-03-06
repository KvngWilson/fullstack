const logger = require("../../../shared/utils/logger");

let subscribersRegistered = false;

function registerCatalogSubscribers(eventDispatcher) {
  if (subscribersRegistered) {
    return;
  }

  eventDispatcher.subscribe("catalog.product.created", async (event) => {
    logger.info("Catalog product created event handled", {
      eventType: event.eventType || event.type,
      productId: event.productId,
      categoryId: event.categoryId,
    });
  });

  subscribersRegistered = true;
}

module.exports = {
  registerCatalogSubscribers,
};
