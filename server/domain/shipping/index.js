/**
 * Shipping Domain
 * 
 * Handles shipment tracking, caching, and webhook processing.
 * 
 * Services:
 * - ShippingCacheService: Shipping rate caching
 * - ShipmentService: Shipment tracking
 * - ShipmentTrackingService: Detailed tracking
 * - FailedWebhookHandler: Webhook retry logic
 */

module.exports = {
  services: {
    ShippingCacheService: require('./services/ShippingCacheService'),
    ShipmentService: require('./services/ShipmentService'),
    ShipmentTrackingService: require('./services/ShipmentTrackingService'),
    FailedWebhookHandler: require('./services/FailedWebhookHandler'),
  },
};
