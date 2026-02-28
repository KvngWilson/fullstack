const Paystack = require('@paystack/paystack-sdk');
const Stripe = require('stripe');
const logger = require('../../utils/logger');

// Initialize Paystack with secret key
const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);

// Initialize Stripe if configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const SUPPORTED_PAYMENT_PROCESSORS = ['paystack', 'stripe'];

const toMinorUnits = (amount) => Math.round(Number(amount) * 100);

/**
 * Initialize a payment transaction
 * @param {Object} params - Payment parameters
 * @param {string} params.email - Customer email
 * @param {number} params.amount - Amount in kobo (for NGN) or smallest currency unit
 * @param {string} params.reference - Unique transaction reference
 * @param {string} params.currency - Currency code (NGN, USD, etc.)
 * @param {Object} params.metadata - Additional transaction metadata
 * @param {string} [params.processor] - Payment processor (paystack|stripe)
 * @returns {Promise<Object>} Payment initialization response
 */
const initializePayment = async (params) => {
  const processor = (params.processor || 'paystack').toLowerCase();

  if (!SUPPORTED_PAYMENT_PROCESSORS.includes(processor)) {
    return {
      success: false,
      data: null,
      message: `Unsupported payment processor: ${processor}`,
    };
  }

  if (processor === 'stripe') {
    return initializeStripePayment(params);
  }

  return initializePaystackPayment(params);
};

const initializePaystackPayment = async (params) => {
  try {
    const { email, amount, reference, currency = 'USD', metadata = {} } = params;

    // Amount should be in smallest currency unit (kobo for NGN, cents for USD)
    const amountInMinorUnits = toMinorUnits(amount);

    const response = await paystack.transaction.initialize({
      email,
      amount: amountInMinorUnits,
      reference,
      currency,
      metadata,
      callback_url: `${process.env.APP_URL || 'http://localhost:5000'}/api/v1/payments/callback`,
    });

    return {
      success: true,
      data: {
        authorization_url: response.data.authorization_url,
        access_code: response.data.access_code,
        reference: response.data.reference,
      },
      message: 'Payment initialized successfully',
    };
  } catch (error) {
    logger.error('Payment initialization error', { error });
    return {
      success: false,
      data: null,
      message: error.message || 'Failed to initialize payment',
      error,
    };
  }
};

const initializeStripePayment = async (params) => {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const {
      email,
      amount,
      reference,
      currency = 'USD',
      metadata = {},
      successUrl,
      cancelUrl,
    } = params;

    const amountInMinorUnits = toMinorUnits(amount);

    const baseUrl = process.env.APP_URL || 'http://localhost:5000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: amountInMinorUnits,
            product_data: {
              name: metadata.product_name || 'Order Payment',
              description: metadata.description || 'Checkout payment',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        reference,
        ...metadata,
      },
      success_url:
        successUrl ||
        `${baseUrl}/api/v1/payments/callback?processor=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${baseUrl}/checkout?status=cancelled&processor=stripe`,
    });

    return {
      success: true,
      data: {
        authorization_url: session.url,
        reference: session.id,
        session_id: session.id,
        payment_intent: session.payment_intent,
      },
      message: 'Stripe checkout session created successfully',
    };
  } catch (error) {
    logger.error('Stripe payment initialization error', { error });
    return {
      success: false,
      data: null,
      message: error.message || 'Failed to initialize stripe payment',
      error,
    };
  }
};

/**
 * Verify a payment transaction
 * @param {string} reference - Transaction reference
 * @param {string} [processor] - Payment processor (paystack|stripe)
 * @returns {Promise<Object>} Payment verification response
 */
const verifyPayment = async (reference, processor = 'paystack') => {
  const normalizedProcessor = processor.toLowerCase();

  if (normalizedProcessor === 'stripe') {
    return verifyStripePayment(reference);
  }

  return verifyPaystackPayment(reference);
};

const verifyPaystackPayment = async (reference) => {
  try {
    const response = await paystack.transaction.verify(reference);

    if (response.data.status === 'success') {
      return {
        success: true,
        data: {
          reference: response.data.reference,
          amount: response.data.amount / 100, // Convert back to major units
          currency: response.data.currency,
          status: response.data.status,
          paid_at: response.data.paid_at,
          channel: response.data.channel,
          customer: response.data.customer,
          metadata: response.data.metadata,
        },
        message: 'Payment verified successfully',
      };
    } else {
      return {
        success: false,
        data: response.data,
        message: `Payment verification failed: ${response.data.gateway_response}`,
      };
    }
  } catch (error) {
    logger.error('Payment verification error', { error });
    return {
      success: false,
      data: null,
      message: error.message || 'Failed to verify payment',
      error,
    };
  }
};

const verifyStripePayment = async (reference) => {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const session = await stripe.checkout.sessions.retrieve(reference, {
      expand: ['payment_intent'],
    });

    const paymentIntent = session.payment_intent;
    const status = session.payment_status || paymentIntent?.status;
    const isSuccess = status === 'paid' || status === 'succeeded';

    return {
      success: isSuccess,
      data: {
        reference: session.id,
        payment_intent: paymentIntent?.id,
        amount: (session.amount_total || paymentIntent?.amount || 0) / 100,
        currency: session.currency || paymentIntent?.currency,
        status,
        paid_at:
          paymentIntent?.status === 'succeeded'
            ? new Date(paymentIntent.created * 1000).toISOString()
            : null,
        channel: 'card',
        customer: {
          email: session.customer_details?.email || paymentIntent?.receipt_email,
        },
        metadata: session.metadata,
      },
      message: isSuccess ? 'Payment verified successfully via Stripe' : `Payment verification failed: ${status}`,
    };
  } catch (error) {
    logger.error('Stripe payment verification error', { error });
    return {
      success: false,
      data: null,
      message: error.message || 'Failed to verify stripe payment',
      error,
    };
  }
};

/**
 * Get transaction details
 * @param {string} reference - Transaction reference
 * @returns {Promise<Object>} Transaction details
 */
const getTransaction = async (reference) => {
  try {
    const response = await paystack.transaction.verify(reference);

    return {
      success: true,
      data: {
        id: response.data.id,
        reference: response.data.reference,
        amount: response.data.amount / 100,
        currency: response.data.currency,
        status: response.data.status,
        gateway_response: response.data.gateway_response,
        paid_at: response.data.paid_at,
        created_at: response.data.created_at,
        channel: response.data.channel,
        customer: response.data.customer,
      },
    };
  } catch (error) {
    logger.error('Get transaction error', { error });
    return {
      success: false,
      data: null,
      message: error.message || 'Failed to get transaction',
    };
  }
};

/**
 * List all transactions
 * @param {Object} options - Query options
 * @param {number} options.perPage - Items per page
 * @param {number} options.page - Page number
 * @returns {Promise<Object>} List of transactions
 */
const listTransactions = async (options = {}) => {
  try {
    const { perPage = 50, page = 1 } = options;

    const response = await paystack.transaction.list({
      perPage,
      page,
    });

    return {
      success: true,
      data: response.data.map(txn => ({
        id: txn.id,
        reference: txn.reference,
        amount: txn.amount / 100,
        currency: txn.currency,
        status: txn.status,
        customer: txn.customer,
        created_at: txn.created_at,
      })),
      meta: response.meta,
    };
  } catch (error) {
    logger.error('List transactions error', { error });
    return {
      success: false,
      data: [],
      message: error.message || 'Failed to list transactions',
    };
  }
};

/**
 * Refund a transaction
 * @param {string} reference - Transaction reference
 * @param {number} amount - Amount to refund (optional, full refund if not specified)
 * @returns {Promise<Object>} Refund response
 */
const refundTransaction = async (reference, amount = null) => {
  try {
    const params = { transaction: reference };
    if (amount) {
      params.amount = Math.round(amount * 100);
    }

    const response = await paystack.refund.create(params);

    return {
      success: true,
      data: {
        id: response.data.id,
        transaction: response.data.transaction,
        amount: response.data.amount / 100,
        currency: response.data.currency,
        status: response.data.status,
      },
      message: 'Refund initiated successfully',
    };
  } catch (error) {
    logger.error('Refund error', { error });
    return {
      success: false,
      data: null,
      message: error.message || 'Failed to process refund',
    };
  }
};

/**
 * Generate a unique payment reference
 * @param {string} prefix - Reference prefix
 * @returns {string} Unique reference
 */
const generateReference = (prefix = 'PAY') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Validate webhook signature
 * @param {string} signature - Webhook signature from header
 * @param {Object} payload - Webhook payload
 * @returns {boolean} Whether signature is valid
 */
const validateWebhookSignature = (signature, payload) => {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
};

const constructStripeEvent = (rawBody, signature) => {
  if (!stripe || !stripeWebhookSecret) {
    throw new Error('Stripe webhook is not configured');
  }

  return stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
};

module.exports = {
  initializePayment,
  verifyPayment,
  getTransaction,
  listTransactions,
  refundTransaction,
  generateReference,
  validateWebhookSignature,
  verifyStripePayment,
  constructStripeEvent,
  SUPPORTED_PAYMENT_PROCESSORS,
};
