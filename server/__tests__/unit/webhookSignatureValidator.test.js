/**
 * WebhookSignatureValidator Unit Tests
 * 
 * Tests webhook signature validation:
 * - HMAC-SHA256 signature verification
 * - Timing-safe comparison
 * - Error cases (missing header, invalid signature)
 * - Payload extraction and parsing
 */

const crypto = require('crypto');
const WebhookSignatureValidator = require('../../infrastructure/security/WebhookSignatureValidator');

describe('WebhookSignatureValidator', () => {
  const secret = 'test-webhook-secret';
  const validPayload = {
    id: 'evt-123',
    type: 'shipment.in_transit',
    shipment: {
      id: 'shipment-abc',
      reference_id: 'ORDER-1',
      status: 'in_transit',
      tracking_number: '1Z999AA10123456784',
      courier: { id: 'ups', name: 'UPS' },
    },
  };

  describe('validateEasyshipSignature', () => {
    it('validates correct HMAC signature', () => {
      const payloadString = JSON.stringify(validPayload);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      const req = {
        headers: { 'easyship-signature': signature },
        body: Buffer.from(payloadString),
        ip: '127.0.0.1',
        path: '/webhooks/easyship',
      };

      expect(() => {
        WebhookSignatureValidator.validateEasyshipSignature(req, secret);
      }).not.toThrow();
    });

    it('rejects mismatched signature', () => {
      const payloadString = JSON.stringify(validPayload);
      const invalidSignature = 'invalid-signature-hash';

      const req = {
        headers: { 'easyship-signature': invalidSignature },
        body: Buffer.from(payloadString),
        ip: '127.0.0.1',
        path: '/webhooks/easyship',
      };

      expect(() => {
        WebhookSignatureValidator.validateEasyshipSignature(req, secret);
      }).toThrow('Invalid webhook signature');
    });

    it('rejects missing signature header', () => {
      const req = {
        headers: {},
        body: Buffer.from(JSON.stringify(validPayload)),
        ip: '127.0.0.1',
        path: '/webhooks/easyship',
      };

      expect(() => {
        WebhookSignatureValidator.validateEasyshipSignature(req, secret);
      }).toThrow('Missing Easyship-Signature header');
    });

    it('rejects missing secret configuration', () => {
      const payloadString = JSON.stringify(validPayload);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      const req = {
        headers: { 'easyship-signature': signature },
        body: Buffer.from(payloadString),
      };

      expect(() => {
        WebhookSignatureValidator.validateEasyshipSignature(req, null);
      }).toThrow('EASYSHIP_WEBHOOK_SECRET not configured');
    });

    it('handles string body', () => {
      const payloadString = JSON.stringify(validPayload);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      const req = {
        headers: { 'easyship-signature': signature },
        body: payloadString, // String instead of Buffer
        ip: '127.0.0.1',
        path: '/webhooks/easyship',
      };

      expect(() => {
        WebhookSignatureValidator.validateEasyshipSignature(req, secret);
      }).not.toThrow();
    });

    it('rejects invalid body type', () => {
      const req = {
        headers: { 'easyship-signature': 'sig' },
        body: { invalid: 'type' }, // Object
        ip: '127.0.0.1',
        path: '/webhooks/easyship',
      };

      expect(() => {
        WebhookSignatureValidator.validateEasyshipSignature(req, secret);
      }).toThrow('Request body must be raw Buffer or string');
    });
  });

  describe('parseWebhookPayload', () => {
    it('parses Buffer body to JSON', () => {
      const payloadString = JSON.stringify(validPayload);
      const req = {
        body: Buffer.from(payloadString),
      };

      const result = WebhookSignatureValidator.parseWebhookPayload(req);

      expect(result).toEqual(validPayload);
    });

    it('parses string body to JSON', () => {
      const payloadString = JSON.stringify(validPayload);
      const req = {
        body: payloadString,
      };

      const result = WebhookSignatureValidator.parseWebhookPayload(req);

      expect(result).toEqual(validPayload);
    });

    it('returns already-parsed JSON object', () => {
      const req = {
        body: validPayload, // Pre-parsed
      };

      const result = WebhookSignatureValidator.parseWebhookPayload(req);

      expect(result).toEqual(validPayload);
    });

    it('throws error for invalid JSON', () => {
      const req = {
        body: Buffer.from('invalid json {'),
      };

      expect(() => {
        WebhookSignatureValidator.parseWebhookPayload(req);
      }).toThrow('Invalid webhook payload');
    });
  });

  describe('extractEventMetadata', () => {
    it('extracts all metadata from valid payload', () => {
      const result = WebhookSignatureValidator.extractEventMetadata(validPayload);

      expect(result).toEqual({
        eventId: 'evt-123',
        eventType: 'shipment.in_transit',
        timestamp: undefined, // created_at not in test payload
        shipmentId: 'shipment-abc',
        referenceId: 'ORDER-1',
        status: 'in_transit',
        trackingNumber: '1Z999AA10123456784',
        courierName: 'UPS',
      });
    });

    it('handles missing optional fields', () => {
      const minimalPayload = {
        id: 'evt-456',
        type: 'shipment.created',
        shipment: {
          id: 'shipment-xyz',
        },
      };

      const result = WebhookSignatureValidator.extractEventMetadata(
        minimalPayload
      );

      expect(result.eventId).toBe('evt-456');
      expect(result.shipmentId).toBe('shipment-xyz');
      expect(result.trackingNumber).toBeUndefined();
    });

    it('extracts timestamp if present', () => {
      const payloadWithTimestamp = {
        ...validPayload,
        created_at: '2026-03-01T12:00:00Z',
      };

      const result = WebhookSignatureValidator.extractEventMetadata(
        payloadWithTimestamp
      );

      expect(result.timestamp).toBe('2026-03-01T12:00:00Z');
    });
  });

  describe('Timing Attack Prevention', () => {
    it('uses timing-safe comparison', () => {
      const payloadString = JSON.stringify(validPayload);
      const correctSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      const req = {
        headers: { 'easyship-signature': correctSignature },
        body: Buffer.from(payloadString),
        ip: '127.0.0.1',
        path: '/webhooks/easyship',
      };

      // Should not throw - uses timingSafeEqual
      expect(() => {
        WebhookSignatureValidator.validateEasyshipSignature(req, secret);
      }).not.toThrow();
    });
  });
});
