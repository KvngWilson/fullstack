/**
 * ShippingWebhookController - Handle incoming Easyship webhooks
 * 
 * Features:
 * - HMAC-SHA256 signature validation
 * - Idempotent event processing
 * - Error handling and logging
 * - Rate limiting (should be configured in routes)
 * - Tenant isolation (no cross-vendor operations)
 */

const { asyncHandler } = require('../../../../shared/utils/errors');
const { successResponse } = require('../../../../shared/utils/response');
const logger = require('../../../../shared/utils/logger');
const WebhookSignatureValidator = require('../../../../infrastructure/security/WebhookSignatureValidator');

/**
 * POST /webhooks/easyship
 * Receive and process Easyship webhook events
 */
const handleEasyshipWebhook = asyncHandler(async (req, res, next) => {
  const { trackingService } = req.app.locals;

  try {
    // Validate signature
    const secret = process.env.EASYSHIP_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('EASYSHIP_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook configuration error' });
    }

    try {
      WebhookSignatureValidator.validateEasyshipSignature(req, secret);
    } catch (signatureError) {
      logger.warn('Webhook signature validation failed', {
        error: signatureError.message,
        ip: req.ip,
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse webhook payload
    let payload;
    try {
      payload = WebhookSignatureValidator.parseWebhookPayload(req);
    } catch (parseError) {
      logger.warn('Failed to parse webhook payload', {
        error: parseError.message,
      });
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Extract event metadata
    const eventMetadata = WebhookSignatureValidator.extractEventMetadata(
      payload
    );

    if (!eventMetadata.eventId) {
      logger.warn('Missing event ID in webhook payload', { payload });
      return res.status(400).json({ error: 'Missing event ID' });
    }

    if (!eventMetadata.shipmentId) {
      logger.warn('Missing shipment ID in webhook payload', { payload });
      return res.status(400).json({ error: 'Missing shipment ID' });
    }

    // Process webhook event
    const result = await trackingService.processWebhookEvent({
      externalEventId: eventMetadata.eventId,
      provider: 'easyship',
      eventType: eventMetadata.eventType,
      shipmentId: eventMetadata.shipmentId,
      status: eventMetadata.status,
      trackingNumber: eventMetadata.trackingNumber,
      courierName: eventMetadata.courierName,
      payload: JSON.stringify(payload),
    });

    logger.info('Webhook processed', {
      eventId: eventMetadata.eventId,
      shipmentId: eventMetadata.shipmentId,
      processed: result.processed,
    });

    // Return 200 OK regardless (idempotent)
    res.status(200).json({
      success: true,
      eventId: eventMetadata.eventId,
      processed: result.processed,
    });
  } catch (error) {
    logger.error('Webhook handler error', {
      error: error.message,
      stack: error.stack,
    });

    // Return error response but still 200 to prevent Easyship retries
    // (we've recorded the event in DB for manual retry)
    res.status(200).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /webhooks/easyship/health
 * Health check endpoint for webhook receiver
 */
const checkWebhookHealth = asyncHandler(async (req, res) => {
  res.status(200).json({
    status: 'healthy',
    webhook: 'easyship',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /orders/:orderId/shipment/events
 * Get webhook event history for order (authenticated)
 */
const getShipmentEventHistory = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { trackingService } = req.app.locals;
  const vendorId = req.user?.id; // From auth middleware

  if (!vendorId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const events = await trackingService.getEventHistoryForOrder(
    orderId,
    vendorId
  );

  res.status(200).json(
    successResponse({
      orderId,
      eventCount: events.length,
      events,
    })
  );
});

module.exports = {
  handleEasyshipWebhook,
  checkWebhookHealth,
  getShipmentEventHistory,
};
