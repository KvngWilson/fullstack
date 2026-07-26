/**
 * Payment Webhook Handlers
 *
 * Each handler wraps the existing PaymentService webhook logic so that
 * webhook jobs dequeued from Bull can be dispatched to the right provider.
 *
 * Usage:
 *   const handlers = createWebhookHandlers();
 *   await initializeJobQueues(emailService, handlers);
 *
 * Handler contract required by WebhookJobQueue:
 *   handler.handle(event, data) → Promise<any>
 */

const { logger } = require('../../../shared/utils/logger');

function createWebhookHandlers() {
  // Lazy-require to avoid circular deps during startup
  const getPaymentService = () => {
    const PaymentService = require('../../../domain/payment/services/PaymentService');
    return new PaymentService();
  };

  const stripe = {
    async handle(event, data) {
      logger.info('Processing queued Stripe webhook', { event });
      const svc = getPaymentService();
      await svc.handleWebhook(event, data, 'stripe');
      return { provider: 'stripe', event };
    },
  };

  const paystack = {
    async handle(event, data) {
      logger.info('Processing queued Paystack webhook', { event });
      const svc = getPaymentService();
      await svc.handleWebhook(event, data, 'paystack');
      return { provider: 'paystack', event };
    },
  };

  return { stripe, paystack };
}

module.exports = { createWebhookHandlers };
