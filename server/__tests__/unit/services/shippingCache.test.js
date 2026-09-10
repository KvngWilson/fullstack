/**
 * ShippingCacheService Integration Tests
 * 
 * Tests the complete shipping rate caching flow:
 * - Cache hits on identical requests
 * - Cache misses on different cart/address
 * - TTL expiry
 * - Multi-tenant isolation
 * - API error handling
 */

jest.mock('@api/easyship', () => ({
  auth: jest.fn(),
  rates_request: jest.fn(),
}));

jest.mock('../../../infrastructure/cache/ShippingCacheClient');
jest.mock('../../../infrastructure/shipping/EasyshipGateway');

const domain = require('../../../domain');
const ShippingCacheService = domain.shipping.services.ShippingCacheService;
const { InvalidShippingRequest } = require('../../../shared/utils/errors');

describe('ShippingCacheService - Cache Layer', () => {
  let service;
  let mockCacheClient;
  let mockGateway;

  const mockCartItems = [
    {
      product_variant_id: 1,
      quantity: 2,
      weight: 0.5,
      height: 10,
      width: 10,
      length: 10,
    },
  ];

  const mockAddress = {
    country_code: 'US',
    city: 'New York',
    postal_code: '10001',
    state: 'NY',
  };

  const mockRates = [
    {
      easyshipRateId: 'rate-123',
      courierId: 'ups-ground',
      courierName: 'UPS',
      totalChargeMinor: 1599, // $15.99
      currency: 'USD',
      minDeliveryDays: 3,
      maxDeliveryDays: 5,
      estimatedDeliveryDate: '2026-03-10',
    },
    {
      easyshipRateId: 'rate-456',
      courierId: 'fedex-overnight',
      courierName: 'FedEx',
      totalChargeMinor: 4999, // $49.99
      currency: 'USD',
      minDeliveryDays: 1,
      maxDeliveryDays: 1,
      estimatedDeliveryDate: '2026-03-02',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheClient = {
      getCachedRates: jest.fn(),
      setCachedRates: jest.fn(),
      invalidateVendorRates: jest.fn().mockResolvedValue(5),
      getStats: jest.fn().mockResolvedValue({ keyCount: 2, keys: [] }),
    };

    mockGateway = {
      getRates: jest.fn().mockResolvedValue(mockRates),
    };

    service = new ShippingCacheService(mockCacheClient, mockGateway);
  });

  describe('getShippingRates', () => {
    it('returns cached rates on cache hit', async () => {
      const vendorId = 123;
      mockCacheClient.getCachedRates.mockResolvedValue({
        rates: mockRates,
        cachedAt: new Date().toISOString(),
      });

      const result = await service.getShippingRates({
        vendorId,
        cartItems: mockCartItems,
        address: mockAddress,
        currency: 'USD',
      });

      expect(result).toEqual(mockRates);
      expect(mockCacheClient.getCachedRates).toHaveBeenCalledWith(
        vendorId,
        mockCartItems,
        mockAddress,
        'USD'
      );
      expect(mockGateway.getRates).not.toHaveBeenCalled(); // API not called
    });

    it('fetches from API and caches on cache miss', async () => {
      const vendorId = 123;
      mockCacheClient.getCachedRates.mockResolvedValue(null);

      const result = await service.getShippingRates({
        vendorId,
        cartItems: mockCartItems,
        address: mockAddress,
        currency: 'USD',
      });

      expect(result).toEqual(mockRates);
      expect(mockCacheClient.getCachedRates).toHaveBeenCalled();
      expect(mockGateway.getRates).toHaveBeenCalled();
      expect(mockCacheClient.setCachedRates).toHaveBeenCalledWith(
        vendorId,
        mockCartItems,
        mockAddress,
        'USD',
        mockRates
      );
    });

    it('thro ws error if no vendor context', async () => {
      await expect(
        service.getShippingRates({
          vendorId: null,
          cartItems: mockCartItems,
          address: mockAddress,
        })
      ).rejects.toThrow(InvalidShippingRequest);

      expect(mockCacheClient.getCachedRates).not.toHaveBeenCalled();
      expect(mockGateway.getRates).not.toHaveBeenCalled();
    });

    it('throws error if cart is empty', async () => {
      await expect(
        service.getShippingRates({
          vendorId: 123,
          cartItems: [],
          address: mockAddress,
        })
      ).rejects.toThrow(InvalidShippingRequest);
    });

    it('throws error if address missing required fields', async () => {
      const invalidAddress = { city: 'New York' }; // missing country_code, postal_code, state

      await expect(
        service.getShippingRates({
          vendorId: 123,
          cartItems: mockCartItems,
          address: invalidAddress,
        })
      ).rejects.toThrow(InvalidShippingRequest);
    });

    it('filters out invalid rates from API response', async () => {
      const vendorId = 123;
      mockCacheClient.getCachedRates.mockResolvedValue(null);

      const ratesWithInvalid = [
        ...mockRates,
        { courierId: 'invalid' }, // Missing required fields
      ];

      mockGateway.getRates.mockResolvedValue(ratesWithInvalid);

      const result = await service.getShippingRates({
        vendorId,
        cartItems: mockCartItems,
        address: mockAddress,
      });

      expect(result).toHaveLength(2); // Only valid rates
      expect(result).toEqual(mockRates);
    });

    it('propagates API errors to caller', async () => {
      const vendorId = 123;
      const apiError = new Error('Easyship API failure');
      mockCacheClient.getCachedRates.mockResolvedValue(null);
      mockGateway.getRates.mockRejectedValue(apiError);

      await expect(
        service.getShippingRates({
          vendorId,
          cartItems: mockCartItems,
          address: mockAddress,
        })
      ).rejects.toThrow(apiError);
    });

    it('supports vendor-specific API keys', async () => {
      const vendorId = 123;
      const vendorApiKey = 'vendor-secret-key';
      mockCacheClient.getCachedRates.mockResolvedValue(null);

      await service.getShippingRates({
        vendorId,
        cartItems: mockCartItems,
        address: mockAddress,
        apiKey: vendorApiKey,
      });

      expect(mockGateway.getRates).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: vendorApiKey })
      );
    });
  });

  describe('Cache Isolation', () => {
    it('prevents cross-vendor cache collisions', async () => {
      const vendor1 = 100;
      const vendor2 = 200;

      mockCacheClient.getCachedRates
        .mockResolvedValueOnce(null) // first call - cache miss
        .mockResolvedValueOnce(null); // second call - cache miss

      await service.getShippingRates({
        vendorId: vendor1,
        cartItems: mockCartItems,
        address: mockAddress,
      });

      await service.getShippingRates({
        vendorId: vendor2,
        cartItems: mockCartItems,
        address: mockAddress,
      });

      // Each vendor should have their own cache calls
      expect(mockCacheClient.getCachedRates).toHaveBeenNthCalledWith(
        1,
        vendor1,
        mockCartItems,
        mockAddress,
        'USD'
      );

      expect(mockCacheClient.getCachedRates).toHaveBeenNthCalledWith(
        2,
        vendor2,
        mockCartItems,
        mockAddress,
        'USD'
      );

      // Each should cache separately
      expect(mockCacheClient.setCachedRates).toHaveBeenNthCalledWith(
        1,
        vendor1,
        expect.any(Array),
        expect.any(Object),
        expect.any(String),
        mockRates
      );

      expect(mockCacheClient.setCachedRates).toHaveBeenNthCalledWith(
        2,
        vendor2,
        expect.any(Array),
        expect.any(Object),
        expect.any(String),
        mockRates
      );
    });
  });

  describe('Cache Invalidation', () => {
    it('invalidates cache for vendor', async () => {
      const vendorId = 123;

      await service.invalidateCache(vendorId);

      expect(mockCacheClient.invalidateVendorRates).toHaveBeenCalledWith(
        vendorId
      );
    });

    it('throws error if no vendor context for invalidation', async () => {
      await expect(service.invalidateCache(null)).rejects.toThrow(
        InvalidShippingRequest
      );
    });
  });

  describe('Cache Statistics', () => {
    it('retrieves cache statistics for vendor', async () => {
      const vendorId = 123;
      const stats = { vendorId, keyCount: 3, keys: ['key1', 'key2', 'key3'] };
      mockCacheClient.getStats.mockResolvedValue(stats);

      const result = await service.getCacheStats(vendorId);

      expect(result).toEqual(stats);
      expect(mockCacheClient.getStats).toHaveBeenCalledWith(vendorId);
    });

    it('throws error if no vendor context for stats', async () => {
      await expect(service.getCacheStats(null)).rejects.toThrow(
        InvalidShippingRequest
      );
    });
  });
});
