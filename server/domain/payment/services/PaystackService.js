/**
 * Paystack Payment Service
 * Handles Paystack-specific payment operations
 */

const crypto = require("crypto");
const Paystack = require("@paystack/paystack-sdk");
const logger = require("../../../shared/utils/logger");

// Initialize Paystack
const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);

/**
 * Convert amount from major units to minor units (multiply by 100)
 * @param {number} amount - Amount in major units
 * @returns {number} Amount in minor units
 */
const toMinorUnits = (amount) => {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid amount: must be a non-negative number");
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
    throw new Error("Invalid amount");
  }
  return amount / 100;
};

/**
 * Initialize a Paystack payment
 * @param {Object} params - Payment parameters
 * @param {string} params.email - Customer email address
 * @param {number} params.amount - Amount in major units (dollars, naira, etc.)
 * @param {string} params.reference - Unique transaction reference
 * @param {string} [params.currency='USD'] - Currency code
 * @param {Object} [params.metadata={}] - Additional metadata
 * @returns {Promise<{success: boolean, data: Object, message: string}>}
 */
async function initializePayment(params) {
  try {
    const {
      email,
      amount,
      reference,
      currency = "USD",
      metadata = {},
    } = params;

    // Validate inputs
    if (!email || !amount || !reference) {
      throw new Error("Email, amount, and reference are required");
    }

    // Convert to minor units
    const amountInMinorUnits = toMinorUnits(amount);

    const response = await paystack.transaction.initialize({
      email,
      amount: amountInMinorUnits,
      reference,
      currency,
      metadata,
      callback_url: `${process.env.APP_URL || "http://localhost:5000"}/api/v1/payments/callback`,
    });

    if (!response.status || !response.data) {
      throw new Error("Invalid Paystack response");
    }

    return {
      success: true,
      data: {
        authorization_url: response.data.authorization_url,
        access_code: response.data.access_code,
        reference: response.data.reference,
      },
      message: "Payment initialized successfully",
    };
  } catch (error) {
    // Re-throw validation errors (like negative amount)
    if (
      error.message.includes("Invalid amount") ||
      error.message.includes("must be a non-negative")
    ) {
      throw error;
    }

    logger.error("Paystack initialization error", {
      error: error.message,
      params: {
        email: params?.email,
        amount: params?.amount,
        reference: params?.reference,
      },
    });

    return {
      success: false,
      data: null,
      message: error.message || "Failed to initialize payment",
    };
  }
}

/**
 * Verify a Paystack payment
 * @param {string} reference - Transaction reference
 * @returns {Promise<{success: boolean, data: Object, message: string}>}
 */
async function verifyPayment(reference) {
  try {
    if (!reference) {
      throw new Error("Payment reference is required");
    }

    const response = await paystack.transaction.verify({
      reference,
    });

    if (!response || !response.data) {
      return {
        success: false,
        data: null,
        message: "Payment verification failed",
      };
    }

    const transaction = response.data;

    // Check if payment was successful
    if (transaction.status !== "success") {
      return {
        success: false,
        data: {
          status: transaction.status,
          gateway_response: transaction.gateway_response,
          reference: transaction.reference,
        },
        message: `Payment ${transaction.status}`,
      };
    }

    // Build response with available fields
    const data = {
      status: transaction.status,
      reference: transaction.reference,
      amount: toMajorUnits(transaction.amount), // Convert back to major units
      currency: transaction.currency,
    };

    // Add optional fields if available
    if (transaction.paid_at) data.paid_at = transaction.paid_at;
    if (transaction.customer) data.customer = transaction.customer;
    if (transaction.authorization)
      data.authorization = transaction.authorization;

    return {
      success: true,
      data,
      message: "Payment verified successfully",
    };
  } catch (error) {
    logger.error("Paystack verification error", {
      error: error.message,
      reference,
    });

    return {
      success: false,
      data: null,
      message: error.message || "Failed to verify payment",
    };
  }
}

/**
 * Get transaction details
 * @param {string} reference - Transaction reference
 * @returns {Promise<{success: boolean, data: Object, message: string}>}
 */
async function getTransaction(reference) {
  try {
    if (!reference) {
      throw new Error("Payment reference is required");
    }

    const response = await paystack.transaction.fetch({
      reference,
    });

    if (!response.status) {
      throw new Error("Transaction not found");
    }

    const transaction = response.data;

    return {
      success: true,
      data: {
        id: transaction.id,
        reference: transaction.reference,
        amount: toMajorUnits(transaction.amount),
        currency: transaction.currency,
        status: transaction.status,
        paid_at: transaction.paid_at,
        created_at: transaction.created_at,
        customer: transaction.customer,
        authorization: transaction.authorization,
      },
      message: "Transaction retrieved successfully",
    };
  } catch (error) {
    logger.error("Get transaction error", {
      error: error.message,
      reference,
    });

    return {
      success: false,
      data: null,
      message: error.message || "Failed to get transaction",
    };
  }
}

/**
 * Generate a unique payment reference
 * @param {string} [prefix='REF'] - Reference prefix
 * @returns {string} Unique reference
 */
function generateReference(prefix = "REF") {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Validate webhook signature from Paystack
 * @param {string} signature - Webhook signature from header
 * @param {Object} payload - Webhook payload
 * @returns {boolean} True if signature is valid
 */
function validateWebhookSignature(signature, payload) {
  if (!signature || !payload) {
    return false;
  }

  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      logger.warn("PAYSTACK_SECRET_KEY not configured");
      return false;
    }

    // Calculate HMAC SHA512
    const hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    return hash === signature;
  } catch (error) {
    logger.error("Webhook signature validation error", {
      error: error.message,
    });
    return false;
  }
}

module.exports = {
  initializePayment,
  verifyPayment,
  getTransaction,
  generateReference,
  validateWebhookSignature,
  toMinorUnits,
  toMajorUnits,
};
