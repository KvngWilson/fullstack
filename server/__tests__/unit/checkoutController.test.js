/**
 * Checkout Controller Unit Tests
 * 
 * Tests order finalization and payment processing:
 * - Checkout finalization with validated orders
 * - Payment processing
 * - Error handling
 * - Checkout validation endpoint
 */

jest.mock('../../shared/utils/logger');

const { checkout: createCheckoutController } = require('../../api/controllers/v1/ordering');
const logger = require('../../shared/utils/logger');

describe('Checkout Controller', () => {
  let controller;
  let mockPaymentService;
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPaymentService = {
      processCheckout: jest.fn(),
    };

    controller = createCheckoutController(mockPaymentService);

    req = {
      user: {
        id: 1,
        vendor_id: 1,
      },
      body: {
        orderId: 1,
        selectedRateId: 'rate-123',
      },
      checkout: {
        validation: {
          isValid: true,
          rate: {
            rate_id: 'rate-123',
            rate: 15.99,
            courier_name: 'FedEx',
          },
        },
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('finalizeCheckout', () => {
    it('finalizes checkout with valid validation', async () => {
      mockPaymentService.processCheckout.mockResolvedValue({
        success: true,
        paymentId: 'pay-123',
        shipmentId: 'ship-456',
      });

      await controller.finalizeCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          paymentId: 'pay-123',
        })
      );
    });

    it('passes validated order data to payment service', async () => {
      mockPaymentService.processCheckout.mockResolvedValue({
        success: true,
        paymentId: 'pay-123',
      });

      await controller.finalizeCheckout(req, res);

      expect(mockPaymentService.processCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 1,
          vendorId: 1,
          selectedRateId: 'rate-123',
          shippingCost: 15.99,
          courierName: 'FedEx',
          easyshipRateId: 'rate-123',
        })
      );
    });

    it('returns 400 if validation failed', async () => {
      req.checkout.validation = {
        isValid: false,
        error: 'Invalid rate',
      };

      await controller.finalizeCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid rate',
        })
      );
    });

    it('handles payment service errors', async () => {
      mockPaymentService.processCheckout.mockResolvedValue({
        success: false,
        error: 'Payment declined',
      });

      await controller.finalizeCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Payment declined',
        })
      );
    });

    it('handles unexpected errors', async () => {
      mockPaymentService.processCheckout.mockRejectedValue(
        new Error('Service error')
      );

      await controller.finalizeCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Checkout finalization failed',
        })
      );
    });

    it('logs successful checkout', async () => {
      mockPaymentService.processCheckout.mockResolvedValue({
        success: true,
        paymentId: 'pay-123',
        shipmentId: 'ship-456',
      });

      await controller.finalizeCheckout(req, res);

      expect(logger.info).toHaveBeenCalledWith(
        'Checkout finalized successfully',
        expect.objectContaining({
          orderId: 1,
          paymentId: 'pay-123',
        })
      );
    });

    it('includes shipment ID in response', async () => {
      mockPaymentService.processCheckout.mockResolvedValue({
        success: true,
        paymentId: 'pay-123',
        shipmentId: 'ship-789',
      });

      await controller.finalizeCheckout(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          shipmentId: 'ship-789',
        })
      );
    });

    it('returns 400 if validation object missing', async () => {
      req.checkout = {};

      await controller.finalizeCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateCheckoutOnly', () => {
    it('returns validation result without finalizing', async () => {
      await controller.validateCheckoutOnly(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: true,
          rate: expect.objectContaining({
            rate_id: 'rate-123',
            rate: 15.99,
          }),
        })
      );
    });

    it('does not call payment service', async () => {
      await controller.validateCheckoutOnly(req, res);

      expect(mockPaymentService.processCheckout).not.toHaveBeenCalled();
    });

    it('returns error if validation failed', async () => {
      req.checkout.validation = {
        isValid: false,
        error: 'Invalid rate',
        rate: null,
      };

      await controller.validateCheckoutOnly(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: false,
          error: 'Invalid rate',
          rate: null,
        })
      );
    });

    it('includes rate details in response', async () => {
      await controller.validateCheckoutOnly(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          rate: {
            rate_id: 'rate-123',
            rate: 15.99,
            courier_name: 'FedEx',
          },
        })
      );
    });

    it('handles missing validation result', async () => {
      req.checkout = {};

      await controller.validateCheckoutOnly(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation not performed',
        })
      );
    });

    it('handles unexpected errors', async () => {
      req.checkout.validation = null;

      await controller.validateCheckoutOnly(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Integration Scenarios', () => {
    it('processes complete finalization flow', async () => {
      mockPaymentService.processCheckout.mockResolvedValue({
        success: true,
        paymentId: 'pay-123',
        shipmentId: 'ship-456',
      });

      await controller.finalizeCheckout(req, res);

      expect(mockPaymentService.processCheckout).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('handles validation then finalization workflow', async () => {
      // First validate
      await controller.validateCheckoutOnly(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: true,
        })
      );

      // Then finalize
      mockPaymentService.processCheckout.mockResolvedValue({
        success: true,
        paymentId: 'pay-123',
      });

      await controller.finalizeCheckout(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('prevents finalization if validation failed', async () => {
      req.checkout.validation = {
        isValid: false,
        error: 'Cart changed',
      };

      await controller.finalizeCheckout(req, res);

      expect(mockPaymentService.processCheckout).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
