/**
 * FailedWebhookHandler - Process failed webhook events with retry
 * 
 * Handles:
 * - Retrieving failed webhook events from database
 * - Implementing exponential backoff retry strategy
 * - Max 3 attempt limit per event
 * - Recording failure reasons
 * - Alerting on permanent failures
 */

const logger = require('../../../shared/utils/logger');
const MetricsRegistry = require('../../../infrastructure/metrics/MetricsRegistry');
const StructuredLogger = require('../../../infrastructure/logging/StructuredLogger');
const { sendOpsAlert } = require('../../../infrastructure/notifications/alerts');
const { fireAndForgetWithErrorLog } = require('../../../shared/utils/asyncErrorHandler');

class FailedWebhookHandler {
  constructor(webhookEventRepository, trackingService) {
    this.webhookEventRepository = webhookEventRepository;
    this.trackingService = trackingService;
    this.metricsRegistry = new MetricsRegistry();
    this.structuredLogger = new StructuredLogger('FailedWebhookHandler');

    this.maxRetries = 3;
    this.baseDelayMs = 5000;
    this.backoffMultiplier = 2;
  }

  /**
   * Process all pending failed webhook events
   * 
   * @param {number} limit - Max events to process (default: 10)
   * @returns {Promise<object>} - { processed, succeeded, failed, permanent }
   */
  async processPendingEvents(limit = 10) {
    try {
      const events = await this.webhookEventRepository.getPendingEvents(limit);

      if (events.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0, permanent: 0 };
      }

      logger.info('Processing pending webhook events', {
        count: events.length,
      });

      const results = {
        processed: events.length,
        succeeded: 0,
        failed: 0,
        permanent: 0,
      };

      for (const event of events) {
        const result = await this.retryEvent(event);

        if (result.succeeded) {
          results.succeeded++;
        } else if (result.permanent) {
          results.permanent++;
        } else {
          results.failed++;
        }
      }

      return results;
    } catch (error) {
      logger.error('Failed webhook processing error', {
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Retry a specific failed webhook event
   * 
   * @param {object} event - Webhook event from database
   * @returns {Promise<object>} - { succeeded, permanent, error?, nextRetryIn? }
   */
  async retryEvent(event) {
    try {
      logger.info('Retrying webhook event', {
        eventId: event.event_id,
        provider: event.provider,
        retryCount: event.retry_count,
      });

      const payload = typeof event.payload === 'string'
        ? JSON.parse(event.payload)
        : event.payload;

      try {
        await this.trackingService.processWebhookEvent({
          externalEventId: payload.event_id,
          shipmentId: payload.shipment_id,
          status: payload.status,
          trackingNumber: payload.tracking_number,
          estimatedDeliveryDate: payload.estimated_delivery_date,
        });

        await this.webhookEventRepository.markProcessed(
          event.event_id,
          event.shipment_id
        );

        logger.info('Webhook event processed successfully after retry', {
          eventId: event.event_id,
          retryCount: event.retry_count,
        });

        return { succeeded: true };
      } catch (processError) {
        event.retry_count++;

        if (event.retry_count < this.maxRetries) {
          const delayMs = this.baseDelayMs * Math.pow(this.backoffMultiplier, event.retry_count - 1);

          await this.webhookEventRepository.incrementRetryCount(event.event_id);

          logger.warn('Webhook event retry scheduled', {
            eventId: event.event_id,
            retryCount: event.retry_count,
            delayMs,
            error: processError.message,
          });

          return {
            succeeded: false,
            permanent: false,
            error: processError.message,
            nextRetryIn: delayMs,
          };
        } else {
          const errorReason = `Permanent failure: ${processError.message}`;

          await this.webhookEventRepository.markFailed(
            event.event_id,
            errorReason
          );

          logger.error('Webhook event failed permanently', {
            eventId: event.event_id,
            retryCount: event.retry_count,
            provider: event.provider,
            error: processError.message,
          });

          await this.alertPermanentFailure(event, processError);

          return {
            succeeded: false,
            permanent: true,
            error: processError.message,
          };
        }
      }
    } catch (error) {
      logger.error('Failed to retry webhook event', {
        eventId: event.event_id,
        error: error.message,
      });

      return {
        succeeded: false,
        permanent: false,
        error: error.message,
      };
    }
  }

  /**
   * Alert on permanent failure
   * @private
   */
  async alertPermanentFailure(event, error) {
    const alertContext = {
      provider: event.provider,
      eventId: event.event_id,
      shipmentId: event.shipment_id,
      orderId: event.order_id,
      error: error.message,
      action: 'MANUAL_INSPECTION_REQUIRED',
      timestamp: new Date().toISOString(),
    };

    logger.error('ALERT: Webhook permanently failed', alertContext);
    this.structuredLogger.error('ALERT: Webhook permanently failed', alertContext, error);

    this.metricsRegistry.incrementCounter('webhook_permanent_failure', 1);
    this.metricsRegistry.incrementCounter(`webhook_failure_by_provider_${event.provider}`, 1);

    await fireAndForgetWithErrorLog(
      async () => {
        await sendOpsAlert({
          severity: 'critical',
          title: `Webhook Permanently Failed: ${event.provider}`,
          description: `Failed to process webhook event after max retries. Manual intervention required.`,
          context: alertContext,
          service: 'shipping-webhooks',
          actionRequired: true,
        });
      },
      {
        service: 'FailedWebhookHandler',
        operation: 'alertPermanentFailure',
        context: alertContext,
        severity: 'error'
      }
    );
  }

  /**
   * Get failed events statistics
   */
  async getFailureStats() {
    try {
      const stats = await this.webhookEventRepository.getWebhookStats();

      return {
        byProvider: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get webhook stats', {
        error: error.message,
      });

      return { byProvider: [], error: error.message };
    }
  }
}

module.exports = FailedWebhookHandler;
