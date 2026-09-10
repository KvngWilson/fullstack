/**
 * Stripe Payment Service
 * Handles Stripe-specific payment operations
 */

const Stripe = require('stripe');
const logger = require('../../../shared/utils/logger');
const {
  withChildSpan,
} = require("../../../infrastructure/observability/tracing/tracingScope");

/**
 * Get Stripe instance (lazy initialization for testing)
 */
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2022-11-15',
  });
};

/**
 * Get Stripe webhook secret (read dynamically for testing)
 */
const getStripeWebhookSecret = () => {
  return process.env.STRIPE_WEBHOOK_SECRET;
};

async function traceStripeCall(operation, tags, callback) {
  return withChildSpan(
    `external.stripe.${operation}`,
    {
      tags: {
        "external.system": "stripe",
        "external.operation": operation,
        ...tags,
      },
    },
    callback,
  );
}

/**
 * Convert amount from major units to minor units (multiply by 100)
 * @param {number} amount - Amount in major units (dollars, euros, etc.)
 * @returns {number} Amount in minor units (cents, etc.)
 */
const toMinorUnits = (amount) => {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Invalid amount: must be a non-negative number');
  }
  return Math.round(amount * 100);
};

/**
 * Convert amount from minor units to major units (divide by 100)
 * @param {number} amount - Amount in minor units
 * @returns {number} Amount in major units
 */
const toMajorUnits = (amount) => {
  if (!Number.isFinite(amount)) {
    throw new Error('Invalid amount');
  }
  return amount / 100;
};

/**
 * Create a Stripe PaymentIntent
 * @param {Object} params - Payment parameters
 * @param {number} params.amount - Amount in major units
 * @param {string} params.currency - Currency code (e.g., 'usd', 'eur')
 * @param {string} [params.description] - Payment description
 * @param {Object} [params.metadata={}] - Additional metadata
 * @param {string} [params.statement_descriptor] - Statement descriptor
 * @returns {Promise<{success: boolean, data: Object, message: string}>}
 */
async function createPaymentIntent(params) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const {
      amount,
      currency,
      description,
      metadata = {},
      statement_descriptor,
      customer_email,
    } = params;

    // Validate inputs
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Amount must be a non-negative number');
    }
    if (!currency) {
      throw new Error('Currency is required');
    }

    const amountInMinorUnits = toMinorUnits(amount);

    const intentParams = {
      amount: amountInMinorUnits,
      currency: currency.toLowerCase(),
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    };

    if (description) intentParams.description = description;
    if (statement_descriptor) intentParams.statement_descriptor = statement_descriptor;
    if (customer_email) intentParams.receipt_email = customer_email;

    const paymentIntent = await traceStripeCall(
      "paymentIntents.create",
      {
        "payment.currency": intentParams.currency,
      },
      () =>
        stripe.paymentIntents.create(
          intentParams,
          {
            idempotencyKey: metadata?.idempotency_key || undefined,
          }
        ),
    );

    return {
      success: true,
      data: {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: toMajorUnits(paymentIntent.amount),
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        created: paymentIntent.created,
      },
      message: 'Payment intent created successfully',
    };
  } catch (error) {
    // Re-throw validation errors (like negative amount)
    if (error.message.includes('Invalid amount') || error.message.includes('must be a non-negative')) {
      throw error;
    }

    logger.error('Stripe payment intent creation error', {
      error: error.message,
      params: {
        amount: params?.amount,
        currency: params?.currency,
      },
    });

    return {
      success: false,
      data: null,
      message: error.message || 'Failed to create payment intent',
    };
  }
}

/**
 * Verify a Stripe PaymentIntent
 * @param {string} intentId - Payment intent ID
 * @returns {Promise<{success: boolean, data: Object, message: string}>}
 */
async function verifyPaymentIntent(intentId) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    if (!intentId) {
      throw new Error('Payment intent ID is required');
    }

    const paymentIntent = await traceStripeCall(
      "paymentIntents.retrieve",
      {
        "payment.intent_id": intentId,
      },
      () => stripe.paymentIntents.retrieve(intentId),
    );

    // Check if payment was successful
    if (paymentIntent.status !== 'succeeded') {
      return {
        success: false,
        data: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: toMajorUnits(paymentIntent.amount),
          currency: paymentIntent.currency,
        },
        message: `Payment intent status: ${paymentIntent.status}`,
      };
    }

    return {
      success: true,
      data: {
        id: paymentIntent.id,
        amount: toMajorUnits(paymentIntent.amount),
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        created: paymentIntent.created,
        charges: paymentIntent.charges?.data || [],
        client_secret: paymentIntent.client_secret,
        metadata: paymentIntent.metadata,
      },
      message: 'Payment intent verified successfully',
    };
  } catch (error) {
    logger.error('Stripe payment intent verification error', {
      error: error.message,
      intentId,
    });

    return {
      success: false,
      data: null,
      message: error.message || 'Failed to verify payment intent',
    };
  }
}

/**
 * Create a refund for a Stripe payment
 * @param {string} intentId - Payment intent ID or charge ID
 * @param {number} amount - Refund amount in major units (optional for full refund)
 * @param {string} [reason] - Refund reason
 * @returns {Promise<{success: boolean, data: Object, message: string}>}
 */
async function refundPayment(intentId, amount, reason) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    if (!intentId) {
      throw new Error('Payment intent ID is required');
    }

    const refundParams = {
      payment_intent: intentId,
    };

    if (Number.isFinite(amount) && amount > 0) {
      refundParams.amount = toMinorUnits(amount);
    }

    if (reason) {
      refundParams.reason = reason;
    }

    const refund = await traceStripeCall(
      "refunds.create",
      {
        "payment.intent_id": intentId,
      },
      () => stripe.refunds.create(refundParams),
    );

    return {
      success: refund.status === 'succeeded',
      data: {
        id: refund.id,
        amount: toMajorUnits(refund.amount),
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
        created: refund.created,
        payment_intent: refund.payment_intent,
      },
      message:
        refund.status === 'succeeded'
          ? 'Refund created successfully'
          : `Refund status: ${refund.status}`,
    };
  } catch (error) {
    logger.error('Stripe refund error', {
      error: error.message,
      intentId,
      amount,
      reason,
    });

    return {
      success: false,
      data: null,
      message: error.message || 'Failed to create refund',
    };
  }
}

/**
 * Validate Stripe webhook signature
 * @param {string} payload - Raw webhook payload body
 * @param {string} signature - Signature from Stripe-Signature header
 * @returns {Object} Verified webhook event
 * @throws {Error} If signature is invalid
 */
function validateStripeWebhook(payload, signature) {
  const stripeWebhookSecret = getStripeWebhookSecret();
  if (!stripeWebhookSecret) {
    throw new Error('Stripe webhook secret is not configured');
  }

  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (!payload || !signature) {
    throw new Error('Webhook payload and signature are required');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      stripeWebhookSecret
    );

    return event;
  } catch (error) {
    logger.error('Stripe webhook validation error', {
      error: error.message,
    });

    throw new Error(`Invalid signature`);
  }
}

/**
 * List payment intents for a customer
 * @param {string} customerId - Stripe customer ID
 * @param {number} [limit=10] - Number of results to return
 * @returns {Promise<{success: boolean, data: Array, message: string}>}
 */
async function listPaymentIntents(customerId, limit = 10) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const intents = await traceStripeCall(
      "paymentIntents.list",
      {
        "payment.customer_id": customerId,
      },
      () =>
        stripe.paymentIntents.list({
          customer: customerId,
          limit: Math.min(limit, 100),
        }),
    );

    return {
      success: true,
      data: intents.data.map((intent) => ({
        id: intent.id,
        amount: toMajorUnits(intent.amount),
        currency: intent.currency,
        status: intent.status,
        created: intent.created,
      })),
      message: 'Payment intents retrieved successfully',
    };
  } catch (error) {
    logger.error('Stripe list payment intents error', {
      error: error.message,
      customerId,
    });

    return {
      success: false,
      data: null,
      message: error.message || 'Failed to list payment intents',
    };
  }
}

module.exports = {
  createPaymentIntent,
  verifyPaymentIntent,
  refundPayment,
  validateStripeWebhook,
  listPaymentIntents,
  toMinorUnits,
  toMajorUnits,
};
