/**
 * WebhookSignatureValidator - Validate webhook signatures
 * 
 * Supports:
 * - Easyship HMAC-SHA256 signature validation
 * - Timing-safe comparison to prevent timing attacks
 * - Raw body requirement (express.raw middleware)
 */

const crypto = require('crypto');
const logger = require('../../shared/utils/logger');

/**
 * Webhook Signature Validator.
 * Validates and verifies signed webhook payload integrity.
 */
class WebhookSignatureValidator {
  /**
   * Validate Easyship webhook signature
   * 
   * Requirements:
   * - req.body must be raw Buffer (use bodyParser.raw())
   * - Easyship-Signature header must be present
   * - Secret must be configured via EASYSHIP_WEBHOOK_SECRET
   * 
   * @param {object} req - Express request object
   * @param {string} secret - HMAC secret key
   * @returns {boolean} - True if signature valid
   * @throws {WebhookSignatureError} - If validation fails
   */
  static validateEasyshipSignature(req, secret) {
    if (!secret) {
      throw new Error('EASYSHIP_WEBHOOK_SECRET not configured');
    }

    // Easyship sends signature in header
    const signatureHeader = req.headers['easyship-signature'];
    
    if (!signatureHeader) {
      logger.warn('Missing Easyship-Signature header', {
        ip: req.ip,
        path: req.path,
      });
      throw new Error('Missing Easyship-Signature header');
    }

    // Get raw body - MUST use express.raw() middleware
    let body;
    if (typeof req.body === 'object' && req.body instanceof Buffer) {
      body = req.body;
    } else if (typeof req.body === 'string') {
      body = Buffer.from(req.body);
    } else {
      logger.error('Invalid request body type for webhook validation', {
        bodyType: typeof req.body,
        path: req.path,
      });
      throw new Error('Request body must be raw Buffer or string');
    }

    // Calculate HMAC-SHA256
    // Easyship uses: HMAC-SHA256(webhook_body, webhook_secret)
    const calculatedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    // First check: lengths must match (prevent buffer length timing attacks)
    const signatureBuffer = Buffer.from(signatureHeader);
    const calculatedBuffer = Buffer.from(calculatedSignature);

    if (signatureBuffer.length !== calculatedBuffer.length) {
      logger.warn('Invalid webhook signature', {
        ip: req.ip,
        path: req.path,
        reason: 'signature length mismatch',
      });
      throw new Error('Invalid webhook signature');
    }

    // Timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      signatureBuffer,
      calculatedBuffer
    ).valueOf();

    if (!isValid) {
      logger.warn('Invalid webhook signature', {
        ip: req.ip,
        path: req.path,
      });
      throw new Error('Invalid webhook signature');
    }

    logger.debug('Webhook signature validated', {
      ip: req.ip,
      path: req.path,
    });

    return true;
  }

  /**
   * Extract and parse webhook payload
   * Handles both raw Buffer and JSON requests
   */
  static parseWebhookPayload(req) {
    try {
      if (typeof req.body === 'object' && !(req.body instanceof Buffer)) {
        // Already parsed JSON
        return req.body;
      }

      // Convert Buffer to string, then parse
      const bodyString =
        req.body instanceof Buffer ? req.body.toString('utf-8') : req.body;

      return JSON.parse(bodyString);
    } catch (error) {
      logger.error('Failed to parse webhook payload', {
        error: error.message,
        bodyType: typeof req.body,
      });
      throw new Error('Invalid webhook payload: not valid JSON');
    }
  }

  /**
   * Extract event metadata from Easyship webhook
   */
  static extractEventMetadata(payload) {
    return {
      eventId: payload.id,
      eventType: payload.type,
      timestamp: payload.created_at,
      shipmentId: payload.shipment?.id,
      referenceId: payload.shipment?.reference_id,
      status: payload.shipment?.status,
      trackingNumber: payload.shipment?.tracking_number,
      courierName: payload.shipment?.courier?.name,
    };
  }
}

module.exports = WebhookSignatureValidator;
