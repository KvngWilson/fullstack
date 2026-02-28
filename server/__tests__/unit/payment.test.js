const {
  handleStripeWebhook,
} = require('../../api/controllers/payment');

// Mock Paystack SDK
const mockInitialize = jest.fn();
const mockVerify = jest.fn();
const mockList = jest.fn();
const mockCreate = jest.fn();

jest.mock('@paystack/paystack-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    transaction: {
      initialize: mockInitialize,
      verify: mockVerify,
      list: mockList,
    },
    refund: {
      create: mockCreate,
    },
  }));
});

describe('Payment Service - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializePayment', () => {
    const validParams = {
      email: 'customer@example.com',
      amount: 100.00,
      reference: 'TEST-REF-123',
      currency: 'USD',
      metadata: { order_id: 1 },
    };

    it('should successfully initialize payment', async () => {
      const mockResponse = {
        data: {
          authorization_url: 'https://checkout.paystack.com/test',
          access_code: 'access123',
          reference: 'TEST-REF-123',
        },
      };

      mockInitialize.mockResolvedValue(mockResponse);

      const result = await initializePayment(validParams);

      expect(result.success).toBe(true);
      expect(result.data.authorization_url).toBe(mockResponse.data.authorization_url);
      expect(result.data.reference).toBe('TEST-REF-123');
    });

    it('should convert amount to minor units (cents)', async () => {
      mockInitialize.mockResolvedValue({
        data: { authorization_url: '', access_code: '', reference: '' },
      });

      await initializePayment(validParams);

      const callArgs = mockInitialize.mock.calls[0][0];
      expect(callArgs.amount).toBe(10000); // 100.00 * 100
    });

    it('should include callback_url', async () => {
      mockInitialize.mockResolvedValue({
        data: { authorization_url: '', access_code: '', reference: '' },
      });

      await initializePayment(validParams);

      const callArgs = mockInitialize.mock.calls[0][0];
      expect(callArgs.callback_url).toContain('/api/v1/payments/callback');
    });

    it('should handle initialization errors', async () => {
      mockInitialize.mockRejectedValue(
        new Error('API Error')
      );

      const result = await initializePayment(validParams);

      expect(result.success).toBe(false);
      expect(result.message).toContain('API Error');
    });

    it('should use default currency if not provided', async () => {
      const paramsWithoutCurrency = { ...validParams };
      delete paramsWithoutCurrency.currency;

      mockInitialize.mockResolvedValue({
        data: { authorization_url: '', access_code: '', reference: '' },
      });

      await initializePayment(paramsWithoutCurrency);

      const callArgs = mockInitialize.mock.calls[0][0];
      expect(callArgs.currency).toBe('USD');
    });
  });

  describe('verifyPayment', () => {
    it('should successfully verify payment', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          reference: 'TEST-REF-123',
          amount: 10000,
          currency: 'USD',
          paid_at: '2026-01-04T10:00:00Z',
          channel: 'card',
          customer: { email: 'test@test.com' },
          metadata: {},
        },
      };

      mockVerify.mockResolvedValue(mockResponse);

      const result = await verifyPayment('TEST-REF-123');

      expect(result.success).toBe(true);
      expect(result.data.reference).toBe('TEST-REF-123');
      expect(result.data.amount).toBe(100.00); // Converted back from kobo
    });

    it('should handle failed payment verification', async () => {
      const mockResponse = {
        data: {
          status: 'failed',
          gateway_response: 'Declined',
        },
      };

      mockVerify.mockResolvedValue(mockResponse);

      const result = await verifyPayment('TEST-REF-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });

    it('should handle verification errors', async () => {
      mockVerify.mockRejectedValue(
        new Error('Transaction not found')
      );

      const result = await verifyPayment('INVALID-REF');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Transaction not found');
    });

    it('should convert amount from minor to major units', async () => {
      mockVerify.mockResolvedValue({
        data: {
          status: 'success',
          reference: 'TEST-REF',
          amount: 25000, // 250.00 USD in cents
          currency: 'USD',
          paid_at: '2026-01-04T10:00:00Z',
          channel: 'card',
          customer: {},
          metadata: {},
        },
      });

      const result = await verifyPayment('TEST-REF');

      expect(result.data.amount).toBe(250.00);
    });
  });

  describe('getTransaction', () => {
    it('should retrieve transaction details', async () => {
      const mockResponse = {
        data: {
          id: 123,
          reference: 'TEST-REF-123',
          amount: 10000,
          currency: 'USD',
          status: 'success',
          gateway_response: 'Approved',
          paid_at: '2026-01-04T10:00:00Z',
          created_at: '2026-01-04T09:00:00Z',
          channel: 'card',
          customer: { email: 'test@test.com' },
        },
      };

      mockVerify.mockResolvedValue(mockResponse);

      const result = await getTransaction('TEST-REF-123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(123);
      expect(result.data.amount).toBe(100.00);
    });

    it('should handle errors when getting transaction', async () => {
      mockVerify.mockRejectedValue(
        new Error('Not found')
      );

      const result = await getTransaction('INVALID');

      expect(result.success).toBe(false);
    });
  });

  describe('generateReference', () => {
    it('should generate unique reference with default prefix', () => {
      const ref1 = generateReference();
      const ref2 = generateReference();

      expect(ref1).toMatch(/^PAY-\d+-[A-Z0-9]+$/);
      expect(ref2).toMatch(/^PAY-\d+-[A-Z0-9]+$/);
      expect(ref1).not.toBe(ref2);
    });

    it('should generate reference with custom prefix', () => {
      const ref = generateReference('ORD');

      expect(ref).toMatch(/^ORD-\d+-[A-Z0-9]+$/);
    });

    it('should include timestamp', () => {
      const before = Date.now();
      const ref = generateReference();
      const after = Date.now();

      const timestamp = parseInt(ref.split('-')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should generate different references in quick succession', () => {
      const refs = [];
      for (let i = 0; i < 10; i++) {
        refs.push(generateReference());
      }

      const uniqueRefs = new Set(refs);
      expect(uniqueRefs.size).toBe(10);
    });
  });

  describe('validateWebhookSignature', () => {
    beforeEach(() => {
      process.env.PAYSTACK_SECRET_KEY = 'test-secret-key';
    });

    it('should validate correct webhook signature', () => {
      const crypto = require('crypto');
      const payload = { event: 'charge.success', data: {} };
      const hash = crypto
        .createHmac('sha512', 'test-secret-key')
        .update(JSON.stringify(payload))
        .digest('hex');

      const isValid = validateWebhookSignature(hash, payload);

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = { event: 'charge.success', data: {} };
      const invalidHash = 'invalid-hash';

      const isValid = validateWebhookSignature(invalidHash, payload);

      expect(isValid).toBe(false);
    });

    it('should reject tampered payload', () => {
      const crypto = require('crypto');
      const originalPayload = { event: 'charge.success', data: { amount: 100 } };
      const hash = crypto
        .createHmac('sha512', 'test-secret-key')
        .update(JSON.stringify(originalPayload))
        .digest('hex');

      const tamperedPayload = { event: 'charge.success', data: { amount: 200 } };
      const isValid = validateWebhookSignature(hash, tamperedPayload);

      expect(isValid).toBe(false);
    });
  });
});
