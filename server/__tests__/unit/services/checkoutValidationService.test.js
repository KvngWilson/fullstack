/**
 * CheckoutValidationService Unit Tests
 * 
 * Tests validation of orders before finalization:
 * - Rate selection validation
 * - Shipping cost verification
 * - Cart integrity checks
 * - Address validation
 * - Vendor isolation
 * - Order state validation
 */

const domain = require('../../../domain');
const CheckoutValidationService = domain.ordering.services.CheckoutValidationService;

describe('CheckoutValidationService', () => {
  let service;
  let mockCacheClient;
  let mockGateway;
  let mockRepository;

  const mockOrder = {
    id: 1,
    vendor_id: 1,
    status: 'pending',
    currency: 'USD',
    items: [
      {
        id: 1,
        name: 'Widget',
        quantity: 2,
        weight: 0.5,
      },
    ],
    shipping_address: {
      city: 'New York',
      country_code: 'US',
      postal_code: '10001',
    },
    shipping_cost: 15.99,
  };

  const mockRate = {
    rate_id: 'rate-123',
    rate: 15.99,
    courier_name: 'FedEx',
    metadata: {
      itemCount: 1,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheClient = {
      getCachedRates: jest.fn(),
    };

    mockGateway = {
      getShippingRates: jest.fn(),
    };

    mockRepository = {
      getOrderById: jest.fn(),
    };

    service = new CheckoutValidationService(
      mockCacheClient,
      mockGateway,
      mockRepository
    );
  });

  describe('validateCheckout', () => {
    it('validates complete checkout with valid data', async () => {
      mockCacheClient.getCachedRates.mockResolvedValue([mockRate]);

      const result = await service.validateCheckout(mockOrder, 'rate-123', 1);

      expect(result.isValid).toBe(true);
      expect(result.rate).toEqual(mockRate);
    });

    it('rejects if selectedRateId is missing', async () => {
      const result = await service.validateCheckout(mockOrder, null, 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('selectedRateId');
    });

    it('rejects if vendorId is missing', async () => {
      const result = await service.validateCheckout(mockOrder, 'rate-123', null);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('vendorId');
    });

    it('enforces vendor isolation', async () => {
      const result = await service.validateCheckout(mockOrder, 'rate-123', 999);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('vendor');
    });

    it('handles validation errors gracefully', async () => {
      mockCacheClient.getCachedRates.mockRejectedValue(
        new Error('Cache error')
      );

      const result = await service.validateCheckout(mockOrder, 'rate-123', 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('validates all checks in sequence', async () => {
      mockCacheClient.getCachedRates.mockResolvedValue([mockRate]);

      const result = await service.validateCheckout(mockOrder, 'rate-123', 1);

      expect(mockCacheClient.getCachedRates).toHaveBeenCalled();
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateRateSelection', () => {
    it('finds and returns matching rate from cache', async () => {
      mockCacheClient.getCachedRates.mockResolvedValue([mockRate]);

      const result = await service.validateRateSelection(
        mockOrder,
        'rate-123',
        1
      );

      expect(result.isValid).toBe(true);
      expect(result.rate).toEqual(mockRate);
    });

    it('rejects if rate not found in cache', async () => {
      mockCacheClient.getCachedRates.mockResolvedValue([mockRate]);

      const result = await service.validateRateSelection(
        mockOrder,
        'rate-invalid',
        1
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('handles cache miss', async () => {
      mockCacheClient.getCachedRates.mockResolvedValue(null);

      const result = await service.validateRateSelection(
        mockOrder,
        'rate-123',
        1
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cache');
    });

    it('handles empty cached rates', async () => {
      mockCacheClient.getCachedRates.mockResolvedValue([]);

      const result = await service.validateRateSelection(
        mockOrder,
        'rate-123',
        1
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('No cached rates');
    });

    it('handles cache client errors', async () => {
      mockCacheClient.getCachedRates.mockRejectedValue(
        new Error('Redis error')
      );

      const result = await service.validateRateSelection(
        mockOrder,
        'rate-123',
        1
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe('validateShippingCost', () => {
    it('accepts exact matching cost', async () => {
      const result = await service.validateShippingCost(mockOrder, mockRate);

      expect(result.isValid).toBe(true);
    });

    it('accepts cost within 1 cent rounding tolerance', async () => {
      const orderWithRounding = {
        ...mockOrder,
        shipping_cost: 15.98, // 1 cent difference
      };

      const result = await service.validateShippingCost(
        orderWithRounding,
        mockRate
      );

      expect(result.isValid).toBe(true);
    });

    it('rejects cost difference greater than 1 cent', async () => {
      const orderWithDifference = {
        ...mockOrder,
        shipping_cost: 16.5, // 51 cent difference
      };

      const result = await service.validateShippingCost(
        orderWithDifference,
        mockRate
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cost');
    });

    it('handles zero cost order', async () => {
      const orderWithZeroCost = {
        ...mockOrder,
        shipping_cost: 0,
      };

      const rateWithZeroCost = { ...mockRate, rate: 0 };

      const result = await service.validateShippingCost(
        orderWithZeroCost,
        rateWithZeroCost
      );

      expect(result.isValid).toBe(true);
    });

    it('rejects high cost difference', async () => {
      const orderWithHighDiff = {
        ...mockOrder,
        shipping_cost: 25.99, // $10 difference
      };

      const result = await service.validateShippingCost(
        orderWithHighDiff,
        mockRate
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe('validateCartIntegrity', () => {
    it('accepts order with items', async () => {
      const result = await service.validateCartIntegrity(mockOrder, mockRate);

      expect(result.isValid).toBe(true);
    });

    it('rejects order with zero items', async () => {
      const emptyOrder = {
        ...mockOrder,
        items: [],
      };

      const result = await service.validateCartIntegrity(
        emptyOrder,
        mockRate
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('zero items');
    });

    it('validates item count matches rate metadata', async () => {
      const changedOrder = {
        ...mockOrder,
        items: [
          ...mockOrder.items,
          {
            id: 2,
            name: 'Gadget',
            quantity: 1,
            weight: 0.3,
          },
        ],
      };

      const result = await service.validateCartIntegrity(
        changedOrder,
        mockRate
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('changed');
    });

    it('accepts when rate has no metadata', async () => {
      const rateWithoutMetadata = {
        ...mockRate,
        metadata: null,
      };

      const result = await service.validateCartIntegrity(
        mockOrder,
        rateWithoutMetadata
      );

      expect(result.isValid).toBe(true);
    });

    it('handles missing items array', async () => {
      const orderWithoutItems = {
        ...mockOrder,
        items: undefined,
      };

      const result = await service.validateCartIntegrity(
        orderWithoutItems,
        mockRate
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe('validateAddress', () => {
    it('accepts valid address', async () => {
      const result = await service.validateAddress(mockOrder);

      expect(result.isValid).toBe(true);
    });

    it('rejects missing address', async () => {
      const orderNoAddress = {
        ...mockOrder,
        shipping_address: null,
      };

      const result = await service.validateAddress(orderNoAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('rejects address missing city', async () => {
      const orderMissingCity = {
        ...mockOrder,
        shipping_address: {
          ...mockOrder.shipping_address,
          city: null,
        },
      };

      const result = await service.validateAddress(orderMissingCity);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('city');
    });

    it('rejects address missing country_code', async () => {
      const orderMissingCountry = {
        ...mockOrder,
        shipping_address: {
          ...mockOrder.shipping_address,
          country_code: null,
        },
      };

      const result = await service.validateAddress(orderMissingCountry);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('country_code');
    });

    it('accepts address with optional fields', async () => {
      const minimalAddress = {
        city: 'Boston',
        country_code: 'US',
      };

      const orderWithMinimalAddress = {
        ...mockOrder,
        shipping_address: minimalAddress,
      };

      const result = await service.validateAddress(orderWithMinimalAddress);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateOrderState', () => {
    it('accepts order in pending state', async () => {
      mockRepository.getOrderById.mockResolvedValue(mockOrder);

      const result = await service.validateOrderState(1, 1);

      expect(result.isValid).toBe(true);
      expect(result.order).toEqual(mockOrder);
    });

    it('accepts order in draft state', async () => {
      const draftOrder = { ...mockOrder, status: 'draft' };
      mockRepository.getOrderById.mockResolvedValue(draftOrder);

      const result = await service.validateOrderState(1, 1);

      expect(result.isValid).toBe(true);
    });

    it('rejects order not found', async () => {
      mockRepository.getOrderById.mockResolvedValue(null);

      const result = await service.validateOrderState(999, 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('enforces vendor isolation for order state', async () => {
      mockRepository.getOrderById.mockResolvedValue(mockOrder);

      const result = await service.validateOrderState(1, 999);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('vendor');
    });

    it('rejects order with invalid status', async () => {
      const completedOrder = { ...mockOrder, status: 'completed' };
      mockRepository.getOrderById.mockResolvedValue(completedOrder);

      const result = await service.validateOrderState(1, 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('status');
    });

    it('handles repository errors', async () => {
      mockRepository.getOrderById.mockRejectedValue(
        new Error('DB error')
      );

      const result = await service.validateOrderState(1, 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Failed');
    });
  });

  describe('Integration Scenarios', () => {
    it('successfully validates complete checkout flow', async () => {
      mockCacheClient.getCachedRates.mockResolvedValue([mockRate]);

      const result = await service.validateCheckout(mockOrder, 'rate-123', 1);

      expect(result.isValid).toBe(true);
      expect(result.rate.rate_id).toBe('rate-123');
      expect(result.rate.rate).toBe(15.99);
    });

    it('rejects checkout when multiple validations fail', async () => {
      mockCacheClient.getCachedRates.mockResolvedValue([mockRate]);

      const invalidOrder = {
        ...mockOrder,
        shipping_address: null, // Missing address
      };

      const result = await service.validateCheckout(
        invalidOrder,
        'rate-123',
        1
      );

      expect(result.isValid).toBe(false);
    });

    it('prevents cross-tenant checkout', async () => {
      mockCacheClient.getCachedRates.mockResolvedValue([mockRate]);

      const result = await service.validateCheckout(mockOrder, 'rate-123', 2);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('vendor');
    });

    it('handles checkout with multiple rates in cache', async () => {
      const multipleRates = [
        mockRate,
        { rate_id: 'rate-456', rate: 20.0, courier_name: 'UPS', metadata: { itemCount: 1 } },
        { rate_id: 'rate-789', rate: 18.5, courier_name: 'DHL', metadata: { itemCount: 1 } },
      ];

      mockCacheClient.getCachedRates.mockResolvedValue(multipleRates);

      const orderWithDifferentRate = {
        ...mockOrder,
        shipping_cost: 20.0, // Match the selected rate
      };

      const result = await service.validateCheckout(orderWithDifferentRate, 'rate-456', 1);

      expect(result.isValid).toBe(true);
      expect(result.rate.rate_id).toBe('rate-456');
      expect(result.rate.rate).toBe(20.0);
    });
  });
});
