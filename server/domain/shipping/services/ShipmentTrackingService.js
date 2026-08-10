/**
 * ShipmentTrackingService - Process shipment status updates from webhooks
 * 
 * Responsibilities:
 * - Validate webhook event data
 * - Store events for idempotency/auditability
 * - Update order shipment status
 * - Prevent duplicate processing
 * - Enforce tenant isolation
 */

const logger = require('../../../shared/utils/logger');
const { InvalidShippingRequest } = require('../../../shared/utils/errors');
const { ShipmentStatusPolicy } = require('../policies');
const { ShipmentStatusUpdated } = require('../events');

class ShipmentTrackingService {
  constructor(orderRepository, webhookEventRepository) {
    this.orderRepo = orderRepository;
    this.webhookRepo = webhookEventRepository;
  }

  /**
   * Process incoming webhook event
   * 
   * Flow:
   * 1. Check if event already processed (idempotency)
   * 2. Validate order exists and shipment_id matches
   * 3. Map external status to internal enum
   * 4. Update order shipment status and tracking number
   * 5. Record event as processed
   * 6. Return result
   */
  async processWebhookEvent(params) {
    const {
      externalEventId,
      provider,
      eventType,
      shipmentId,
      status,
      trackingNumber,
      courierName,
      payload,
    } = params;

    try {
      logger.debug('Processing webhook event', {
        externalEventId,
        provider,
        eventType,
        shipmentId,
        status,
      });

      // Check for duplicate processing
      const existingEvent = await this.webhookRepo.getEventById(
        externalEventId
      );

      if (existingEvent?.status === 'processed') {
        logger.info('Webhook event already processed (idempotent)', {
          externalEventId,
        });
        return { processed: false, reason: 'duplicate', eventId: existingEvent.id };
      }

      // Find order by shipment_id
      const order = await this.orderRepo.getOrderByShipmentId(shipmentId);

      if (!order) {
        logger.warn('Shipment not found for webhook event', {
          externalEventId,
          shipmentId,
        });

        // Record as failed for auditing
        await this.webhookRepo.recordEvent({
          event_id: externalEventId,
          provider,
          event_type: eventType,
          shipment_id: shipmentId,
          payload,
          status: 'failed',
          error_message: 'Shipment not found',
        });

        throw new InvalidShippingRequest(`Shipment ${shipmentId} not found`);
      }

      // Map external status to internal enum
      const mappedStatus = this._mapExternalStatus(status);
      const shipmentStatusEvent = new ShipmentStatusUpdated({
        orderId: order.id,
        shipmentId,
        previousStatus: order.shipment_status,
        currentStatus: mappedStatus,
      });

      logger.debug('Updating shipment status', {
        orderId: order.id,
        oldStatus: order.shipment_status,
        newStatus: mappedStatus,
        eventType: shipmentStatusEvent.type,
      });

      // Update order with shipment tracking info
      await this.orderRepo.updateShipmentTracking(order.id, {
        shipment_status: mappedStatus,
        tracking_number: trackingNumber || order.tracking_number,
        courier_name: courierName || order.courier_name,
        shipment_updated_at: new Date(),
      });

      // Record successful event processing
      await this.webhookRepo.recordEvent({
        event_id: externalEventId,
        provider,
        event_type: eventType,
        shipment_id: shipmentId,
        order_id: order.id,
        payload,
        status: 'processed',
        processed_at: new Date(),
      });

      logger.info('Webhook event processed successfully', {
        externalEventId,
        orderId: order.id,
        shipmentId,
        newStatus: mappedStatus,
      });

      return {
        processed: true,
        orderId: order.id,
        shipmentId,
        status: mappedStatus,
        eventId: externalEventId,
      };
    } catch (error) {
      logger.error('Webhook event processing failed', {
        externalEventId,
        shipmentId,
        error: error.message,
      });

      // Attempt to record failure
      try {
        await this.webhookRepo.recordEvent({
          event_id: externalEventId,
          provider,
          event_type: eventType,
          shipment_id: shipmentId,
          payload,
          status: 'failed',
          error_message: error.message,
        });
      } catch (recordError) {
        logger.error('Failed to record webhook event failure', {
          externalEventId,
          recordError: recordError.message,
        });
      }

      throw error;
    }
  }

  /**
   * Map Easyship/external status to internal enum
   * 
   * Easyship statuses: created, shipped, in_transit, delivered, cancelled, exception
   * Internal statuses: pending, label_created, in_transit, delivered, failed, cancelled
   */
  _mapExternalStatus(externalStatus) {
    const mapped = ShipmentStatusPolicy.mapExternalStatus(externalStatus);

    if (!ShipmentStatusPolicy.isKnownExternalStatus(externalStatus)) {
      logger.warn('Unknown shipment status from webhook', {
        externalStatus,
      });
    }

    return mapped;
  }

  /**
   * Get webhook event history for order
   */
  async getEventHistoryForOrder(orderId, vendorId) {
    if (!vendorId) {
      throw new InvalidShippingRequest('Vendor context required');
    }

    // Validate order belongs to vendor
    const order = await this.orderRepo.getOrderById(orderId);
    if (!order || order.tenant_id !== vendorId) {
      throw new InvalidShippingRequest('Order not found or unauthorized');
    }

    return this.webhookRepo.getEventsByOrderId(orderId);
  }

  /**
   * Retry failed webhook event
   */
  async retryFailedEvent(externalEventId) {
    const event = await this.webhookRepo.getEventById(externalEventId);

    if (!event) {
      throw new InvalidShippingRequest('Event not found');
    }

    if (event.retry_count >= 3) {
      throw new InvalidShippingRequest(
        'Event has exceeded retry limit (3 attempts)'
      );
    }

    logger.info('Retrying failed webhook event', {
      externalEventId,
      retryCount: event.retry_count + 1,
    });

    const payload = event.payload;
    
    try {
      const result = await this.processWebhookEvent({
        externalEventId: event.event_id,
        provider: event.provider,
        eventType: event.event_type,
        shipmentId: event.shipment_id,
        status: payload.shipment?.status,
        trackingNumber: payload.shipment?.tracking_number,
        courierName: payload.shipment?.courier?.name,
        payload: JSON.stringify(payload),
      });

      // Increment retry count
      await this.webhookRepo.incrementRetryCount(externalEventId);

      return result;
    } catch (error) {
      await this.webhookRepo.incrementRetryCount(externalEventId);
      throw error;
    }
  }
}

module.exports = ShipmentTrackingService;
