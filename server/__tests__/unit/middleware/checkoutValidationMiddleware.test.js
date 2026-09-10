/**
 * Checkout Validation Middleware Unit Tests
 * 
 * Tests validation middleware behavior:
 * - Running validations before checkout
 * - Storing results in request
 * - Rejecting invalid checkouts
 * - Authenticating requests
 */

jest.mock('../../../shared/utils/logger');

const createCheckoutValidationMiddleware = require('../../../api/middleware/checkoutValidationMiddleware');
const logger = require('../../../shared/utils/logger');

describe('Checkout Validation Middleware', () => {
  let middleware;
  let mockValidationService;
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up logger methods
    logger.warn = jest.fn();
    logger.error = jest.fn();
    logger.info = jest.fn();

    mockValidationService = {
      validateOrderState: jest.fn(),
      validateCheckout: jest.fn(),
    };

    middleware = createCheckoutValidationMiddleware(mockValidationService);

    req = {
      user: {
        id: 1,
        vendor_id: 1,
      },
      body: {
        orderId: 1,
        selectedRateId: 'rate-123',
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('Authentication', () => {
    it('requires authenticated user', async () => {
      delete req.user;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Authentication required',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('extracts vendor ID from user context', async () => {
      const mockOrder = {
        id: 1,
        vendor_id: 1,
        items: [],
        shipping_address: { city: 'NYC', country_code: 'US' },
      };

      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: true,
        order: mockOrder,
      });

      mockValidationService.validateCheckout.mockResolvedValue({
        isValid: true,
        rate: { rate_id: 'rate-123' },
      });

      await middleware(req, res, next);

      expect(mockValidationService.validateOrderState).toHaveBeenCalledWith(
        1,
        1 // vendor_id
      );
    });

    it('handles missing vendor info', async () => {
      delete req.user.vendor_id;
      delete req.user.id;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Order State Validation', () => {
    it('validates order state before checkout', async () => {
      const mockOrder = {
        id: 1,
        vendor_id: 1,
        items: [],
        shipping_address: { city: 'NYC', country_code: 'US' },
      };

      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: true,
        order: mockOrder,
      });

      mockValidationService.validateCheckout.mockResolvedValue({
        isValid: true,
        rate: { rate_id: 'rate-123' },
      });

      await middleware(req, res, next);

      expect(mockValidationService.validateOrderState).toHaveBeenCalledWith(
        1,
        1
      );
    });

    it('rejects if order state validation fails', async () => {
      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: false,
        error: 'Order not found',
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Order not found',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('does not proceed to checkout validation if order state fails', async () => {
      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: false,
        error: 'Invalid status',
      });

      await middleware(req, res, next);

      expect(mockValidationService.validateCheckout).not.toHaveBeenCalled();
    });
  });

  describe('Checkout Validation', () => {
    let mockOrder;

    beforeEach(() => {
      mockOrder = {
        id: 1,
        vendor_id: 1,
        status: 'pending',
        items: [{ id: 1, quantity: 1 }],
        shipping_address: { city: 'NYC', country_code: 'US' },
        shipping_cost: 15.99,
      };

      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: true,
        order: mockOrder,
      });
    });

    it('calls checkout validation with order and rate ID', async () => {
      mockValidationService.validateCheckout.mockResolvedValue({
        isValid: true,
        rate: { rate_id: 'rate-123' },
      });

      await middleware(req, res, next);

      expect(mockValidationService.validateCheckout).toHaveBeenCalledWith(
        mockOrder,
        'rate-123',
        1
      );
    });

    it('stores validation result in request', async () => {
      const mockRate = { rate_id: 'rate-123', rate: 15.99 };

      mockValidationService.validateCheckout.mockResolvedValue({
        isValid: true,
        rate: mockRate,
      });

      await middleware(req, res, next);

      expect(req.checkout.validation).toEqual({
        isValid: true,
        rate: mockRate,
      });
    });

    it('rejects if checkout validation fails', async () => {
      mockValidationService.validateCheckout.mockResolvedValue({
        isValid: false,
        error: 'Invalid rate ID',
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid rate ID',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('proceeds to next middleware if validation passes', async () => {
      mockValidationService.validateCheckout.mockResolvedValue({
        isValid: true,
        rate: { rate_id: 'rate-123' },
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles order state validation errors', async () => {
      mockValidationService.validateOrderState.mockRejectedValue(
        new Error('DB error')
      );

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Checkout validation failed',
        })
      );
    });

    it('handles checkout validation errors', async () => {
      const mockOrder = {
        id: 1,
        vendor_id: 1,
        items: [],
        shipping_address: { city: 'NYC', country_code: 'US' },
      };

      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: true,
        order: mockOrder,
      });

      mockValidationService.validateCheckout.mockRejectedValue(
        new Error('Cache error')
      );

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Checkout validation failed',
        })
      );
    });

    it('logs errors for debugging', async () => {
      mockValidationService.validateOrderState.mockRejectedValue(
        new Error('Test error')
      );

      await middleware(req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Checkout validation'),
        expect.anything()
      );
    });
  });

  describe('Request Preparation', () => {
    it('initializes req.checkout object if missing', async () => {
      const mockOrder = {
        id: 1,
        vendor_id: 1,
        items: [],
        shipping_address: { city: 'NYC', country_code: 'US' },
      };

      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: true,
        order: mockOrder,
      });

      mockValidationService.validateCheckout.mockResolvedValue({
        isValid: true,
        rate: { rate_id: 'rate-123' },
      });

      delete req.checkout;

      await middleware(req, res, next);

      expect(req.checkout).toBeDefined();
      expect(req.checkout.validation).toBeDefined();
    });

    it('preserves existing req.checkout data', async () => {
      const mockOrder = {
        id: 1,
        vendor_id: 1,
        items: [],
        shipping_address: { city: 'NYC', country_code: 'US' },
      };

      req.checkout = { existingData: 'preserved' };

      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: true,
        order: mockOrder,
      });

      mockValidationService.validateCheckout.mockResolvedValue({
        isValid: true,
        rate: { rate_id: 'rate-123' },
      });

      await middleware(req, res, next);

      expect(req.checkout.existingData).toBe('preserved');
      expect(req.checkout.validation).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('processes complete validation flow', async () => {
      const mockOrder = {
        id: 1,
        vendor_id: 1,
        status: 'pending',
        items: [{ id: 1, quantity: 1 }],
        shipping_address: { city: 'NYC', country_code: 'US' },
        shipping_cost: 15.99,
      };

      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: true,
        order: mockOrder,
      });

      mockValidationService.validateCheckout.mockResolvedValue({
        isValid: true,
        rate: { rate_id: 'rate-123', rate: 15.99 },
      });

      await middleware(req, res, next);

      expect(mockValidationService.validateOrderState).toHaveBeenCalled();
      expect(mockValidationService.validateCheckout).toHaveBeenCalled();
      expect(req.checkout.validation.isValid).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    it('stops processing on first validation failure', async () => {
      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: false,
        error: 'Order not found',
      });

      await middleware(req, res, next);

      expect(mockValidationService.validateCheckout).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('handles validation with multiple rates cached', async () => {
      const mockOrder = {
        id: 1,
        vendor_id: 1,
        items: [],
        shipping_address: { city: 'NYC', country_code: 'US' },
        shipping_cost: 15.99,
      };

      mockValidationService.validateOrderState.mockResolvedValue({
        isValid: true,
        order: mockOrder,
      });

      const selectedRate = { rate_id: 'rate-123', rate: 15.99 };

      mockValidationService.validateCheckout.mockResolvedValue({
        isValid: true,
        rate: selectedRate,
      });

      await middleware(req, res, next);

      expect(req.checkout.validation.rate).toEqual(selectedRate);
      expect(next).toHaveBeenCalled();
    });
  });
});
