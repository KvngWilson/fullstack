/**
 * Shipping Webhook Controller Unit Tests
 * 
 * Tests HTTP handlers for webhook integration:
 * - HMAC signature validation
 * - Payload parsing and processing
 * - Status code responses (401, 400, 200)
 * - Event history endpoint with auth
 */

jest.mock('../../../infrastructure/security/WebhookSignatureValidator');
jest.mock('../../../shared/utils/logger');
jest.mock('../../../shared/utils/errors', () => ({
  asyncHandler: (fn) => fn,
}));
jest.mock('../../../shared/utils/response', () => ({
  successResponse: (data) => data,
}));

const { shippingWebhook } = require('../../../api/controllers/v1/ordering');
const {
  handleEasyshipWebhook,
  checkWebhookHealth,
  getShipmentEventHistory,
} = shippingWebhook;

const WebhookSignatureValidator = require('../../../infrastructure/security/WebhookSignatureValidator');
const logger = require('../../../shared/utils/logger');

describe('Shipping Webhook Controller', () => {
  let req, res, next;
  let mockTrackingService;

  const now = new Date();
  const mockWebhookPayload = {
    event_id: 'evt-12345',
    shipment_id: 'shipment-abc123',
    status: 'in_transit',
    tracking_number: 'track-998877',
    estimated_delivery_date: '2026-03-15',
    timestamp: Math.floor(now.getTime() / 1000),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTrackingService = {
      processWebhookEvent: jest.fn(),
      getEventHistoryForOrder: jest.fn(),
    };

    req = {
      body: mockWebhookPayload,
      rawBody: JSON.stringify(mockWebhookPayload),
      headers: {
        'easyship-signature': 'sha256=abc123def456',
      },
      user: {
        id: 1,
        vendor_id: 1,
      },
      params: {
        orderId: 1,
      },
      app: {
        locals: {
          trackingService: mockTrackingService,
        },
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    next = jest.fn();

    process.env.EASYSHIP_WEBHOOK_SECRET = 'test-secret-key';
  });

  describe('POST /webhooks/easyship', () => {
    describe('Signature Validation', () => {
      it('returns 401 if signature is invalid', async () => {
        WebhookSignatureValidator.validateEasyshipSignature.mockImplementation(() => {
          throw new Error('Invalid webhook signature');
        });

        await handleEasyshipWebhook(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining('Invalid'),
          })
        );
      });

      it('validates signature with correct header and body', async () => {
        WebhookSignatureValidator.validateEasyshipSignature.mockReturnValue(true);
        WebhookSignatureValidator.extractEventMetadata.mockReturnValue({
          eventId: 'evt-12345',
          shipmentId: 'shipment-abc123',
          status: 'in_transit',
          trackingNumber: 'track-998877',
        });

        mockTrackingService.processWebhookEvent.mockResolvedValue({
          success: true,
        });

        await handleEasyshipWebhook(req, res, next);

        expect(WebhookSignatureValidator.validateEasyshipSignature).toHaveBeenCalledWith(
          req,
          process.env.EASYSHIP_WEBHOOK_SECRET
        );
      });
    });

    describe('Payload Parsing', () => {
      beforeEach(() => {
        WebhookSignatureValidator.validateEasyshipSignature.mockReturnValue(true);
      });

      it('returns 400 if payload is missing event ID', async () => {
        WebhookSignatureValidator.extractEventMetadata.mockReturnValue({
          eventId: null,
          shipmentId: 'shipment-abc123',
        });

        await handleEasyshipWebhook(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining('event ID'),
          })
        );
      });

      it('returns 400 if payload is missing shipment ID', async () => {
        WebhookSignatureValidator.extractEventMetadata.mockReturnValue({
          eventId: 'evt-12345',
          shipmentId: null,
        });

        await handleEasyshipWebhook(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining('shipment ID'),
          })
        );
      });
    });

    describe('Event Processing', () => {
      beforeEach(() => {
        WebhookSignatureValidator.validateEasyshipSignature.mockReturnValue(true);
        WebhookSignatureValidator.extractEventMetadata.mockReturnValue({
          eventId: 'evt-12345',
          shipmentId: 'shipment-abc123',
          status: 'in_transit',
          trackingNumber: 'track-998877',
        });
      });

      it('processes valid webhook event', async () => {
        mockTrackingService.processWebhookEvent.mockResolvedValue({
          success: true,
          shipmentId: 'shipment-abc123',
          statusUpdate: 'in_transit',
        });

        await handleEasyshipWebhook(req, res, next);

        expect(mockTrackingService.processWebhookEvent).toHaveBeenCalled();
      });

      it('returns 200 on successful processing', async () => {
        mockTrackingService.processWebhookEvent.mockResolvedValue({
          success: true,
        });

        await handleEasyshipWebhook(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('handles service errors gracefully', async () => {
        const error = new Error('Database error');
        mockTrackingService.processWebhookEvent.mockRejectedValue(error);

        await handleEasyshipWebhook(req, res, next);

        // Still returns 200 for idempotency
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        WebhookSignatureValidator.validateEasyshipSignature.mockReturnValue(true);
        WebhookSignatureValidator.extractEventMetadata.mockReturnValue({
          eventId: 'evt-12345',
          shipmentId: 'shipment-abc123',
        });
      });

      it('logs errors for debugging', async () => {
        mockTrackingService.processWebhookEvent.mockRejectedValue(
          new Error('Processing failed')
        );

        await handleEasyshipWebhook(req, res, next);

        expect(logger.error).toHaveBeenCalled();
      });

      it('handles missing webhook secret', async () => {
        delete process.env.EASYSHIP_WEBHOOK_SECRET;

        await handleEasyshipWebhook(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe('GET /webhooks/easyship/health', () => {
    it('returns health status', async () => {
      await checkWebhookHealth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.stringMatching(/healthy|ok/i),
        })
      );
    });

    it('includes timestamp', async () => {
      await checkWebhookHealth(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('GET /orders/:orderId/shipment/events', () => {
    beforeEach(() => {
      req.user = {
        id: 1,
        vendor_id: 1,
      };
    });

    it('requires authentication', async () => {
      delete req.user;

      await getShipmentEventHistory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('retrieves event history for order', async () => {
      const events = [
        {
          id: 1,
          event_type: 'shipment.label_created',
          status: 'processed',
          created_at: now.toISOString(),
        },
      ];

      mockTrackingService.getEventHistoryForOrder.mockResolvedValue(events);

      await getShipmentEventHistory(req, res, next);

      expect(mockTrackingService.getEventHistoryForOrder).toHaveBeenCalledWith(
        1,   // orderId from params (numeric)
        1    // vendor_id
      );
    });

    it('returns event data', async () => {
      const events = [
        {
          id: 1,
          event_type: 'shipment.label_created',
        },
      ];

      mockTrackingService.getEventHistoryForOrder.mockResolvedValue(events);

      await getShipmentEventHistory(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('processes complete webhook flow successfully', async () => {
      WebhookSignatureValidator.validateEasyshipSignature.mockReturnValue(true);
      WebhookSignatureValidator.extractEventMetadata.mockReturnValue({
        eventId: 'evt-12345',
        shipmentId: 'shipment-abc123',
        status: 'in_transit',
      });

      mockTrackingService.processWebhookEvent.mockResolvedValue({
        success: true,
      });

      await handleEasyshipWebhook(req, res, next);

      expect(WebhookSignatureValidator.validateEasyshipSignature).toHaveBeenCalled();
      expect(mockTrackingService.processWebhookEvent).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects webhook with invalid signature early', async () => {
      WebhookSignatureValidator.validateEasyshipSignature.mockImplementation(() => {
        throw new Error('Invalid webhook signature');
      });

      await handleEasyshipWebhook(req, res, next);

      // Should reject before trying to process
      expect(mockTrackingService.processWebhookEvent).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});

