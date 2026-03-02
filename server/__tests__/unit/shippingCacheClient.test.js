/**
 * ShippingCacheClient Unit Tests
 * 
 * Tests Redis operations for shipping rate cache:
 * - Cache key generation and hashing
 * - Get/Set operations
 * - TTL handling
 * - Vendor isolation
 * - Cache invalidation
 */

const ShippingCacheClient = require('../../infrastructure/cache/ShippingCacheClient');

describe('ShippingCacheClient - Redis Operations', () => {
  let cacheClient;
  let mockRedisClient;

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
      totalChargeMinor: 1599,
      currency: 'USD',
    },
  ];

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
      ping: jest.fn(),
    };

    cacheClient = new ShippingCacheClient(mockRedisClient);
  });

  describe('Cache Key Generation', () => {
    it('generates consistent hash for same cart+address', () => {
      const hash1 = cacheClient._generateCacheKeyHash(
        mockCartItems,
        mockAddress,
        'USD'
      );

      const hash2 = cacheClient._generateCacheKeyHash(
        mockCartItems,
        mockAddress,
        'USD'
      );

      expect(hash1).toBe(hash2); // Deterministic
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256
    });

    it('generates different hash for different quantities', () => {
      const hash1 = cacheClient._generateCacheKeyHash(
        mockCartItems,
        mockAddress,
        'USD'
      );

      const modifiedItems = [
        { ...mockCartItems[0], quantity: 5 },
      ];

      const hash2 = cacheClient._generateCacheKeyHash(
        modifiedItems,
        mockAddress,
        'USD'
      );

      expect(hash1).not.toBe(hash2);
    });

    it('generates different hash for different address', () => {
      const hash1 = cacheClient._generateCacheKeyHash(
        mockCartItems,
        mockAddress,
        'USD'
      );

      const diffAddress = { ...mockAddress, city: 'Los Angeles' };
      const hash2 = cacheClient._generateCacheKeyHash(
        mockCartItems,
        diffAddress,
        'USD'
      );

      expect(hash1).not.toBe(hash2);
    });

    it('generates different hash for different currency', () => {
      const hash1 = cacheClient._generateCacheKeyHash(
        mockCartItems,
        mockAddress,
        'USD'
      );

      const hash2 = cacheClient._generateCacheKeyHash(
        mockCartItems,
        mockAddress,
        'EUR'
      );

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getCachedRates', () => {
    it('returns cached rates if they exist', async () => {
      const vendorId = 123;
      const cachedData = {
        rates: mockRates,
        cachedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await cacheClient.getCachedRates(
        vendorId,
        mockCartItems,
        mockAddress,
        'USD'
      );

      expect(result).toEqual(cachedData);
      expect(mockRedisClient.get).toHaveBeenCalled();
    });

    it('returns null if cache miss', async () => {
      const vendorId = 123;
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheClient.getCachedRates(
        vendorId,
        mockCartItems,
        mockAddress,
        'USD'
      );

      expect(result).toBeNull();
    });

    it('includes vendor ID in cache key', async () => {
      const vendorId = 999;
      mockRedisClient.get.mockResolvedValue(null);

      await cacheClient.getCachedRates(
        vendorId,
        mockCartItems,
        mockAddress,
        'USD'
      );

      const callArg = mockRedisClient.get.mock.calls[0][0];
      expect(callArg).toContain(`shipping:rates:${vendorId}:`);
    });

    it('handles Redis errors gracefully', async () => {
      const vendorId = 123;
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await cacheClient.getCachedRates(
        vendorId,
        mockCartItems,
        mockAddress,
        'USD'
      );

      expect(result).toBeNull(); // Graceful degradation
    });
  });

  describe('setCachedRates', () => {
    it('caches rates with standard TTL', async () => {
      const vendorId = 123;
      mockRedisClient.setEx.mockResolvedValue('OK');

      await cacheClient.setCachedRates(
        vendorId,
        mockCartItems,
        mockAddress,
        'USD',
        mockRates
      );

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining('shipping:rates:123:'),
        900, // 15 minutes
        expect.any(String)
      );
    });

    it('caches empty results with shorter TTL', async () => {
      const vendorId = 123;
      mockRedisClient.setEx.mockResolvedValue('OK');

      await cacheClient.setCachedRates(
        vendorId,
        mockCartItems,
        mockAddress,
        'USD',
        [] // Empty results
      );

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.any(String),
        120, // 2 minutes
        expect.any(String)
      );
    });

    it('includes metadata in cached value', async () => {
      const vendorId = 123;
      mockRedisClient.setEx.mockResolvedValue('OK');

      await cacheClient.setCachedRates(
        vendorId,
        mockCartItems,
        mockAddress,
        'USD',
        mockRates
      );

      const cachedValue = JSON.parse(mockRedisClient.setEx.mock.calls[0][2]);
      expect(cachedValue).toHaveProperty('rates');
      expect(cachedValue).toHaveProperty('cachedAt');
      expect(cachedValue).toHaveProperty('vendorId', vendorId);
    });

    it('handles Redis errors gracefully', async () => {
      const vendorId = 123;
      mockRedisClient.setEx.mockRejectedValue(
        new Error('Redis write failed')
      );

      // Should not throw
      await expect(
        cacheClient.setCachedRates(
          vendorId,
          mockCartItems,
          mockAddress,
          'USD',
          mockRates
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('Cache Invalidation', () => {
    it('deletes all vendor cache keys', async () => {
      const vendorId = 123;

      mockRedisClient.scan
        .mockResolvedValueOnce({
          cursor: 0,
          keys: [`shipping:rates:123:hash1`, `shipping:rates:123:hash2`],
        });

      mockRedisClient.del.mockResolvedValue(2);

      const result = await cacheClient.invalidateVendorRates(vendorId);

      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        0,
        expect.objectContaining({
          MATCH: `shipping:rates:${vendorId}:*`,
        })
      );

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `shipping:rates:123:hash1`,
        `shipping:rates:123:hash2`
      );

      expect(result).toBe(2);
    });

    it('handles pagination in scan results', async () => {
      const vendorId = 123;

      mockRedisClient.scan
        .mockResolvedValueOnce({
          cursor: 100,
          keys: [`shipping:rates:123:hash1`],
        })
        .mockResolvedValueOnce({
          cursor: 0,
          keys: [`shipping:rates:123:hash2`],
        });

      mockRedisClient.del
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      const result = await cacheClient.invalidateVendorRates(vendorId);

      expect(mockRedisClient.scan).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);
      expect(result).toBe(2);
    });

    it('handles errors during invalidation', async () => {
      const vendorId = 123;
      mockRedisClient.scan.mockRejectedValue(new Error('Scan failed'));

      const result = await cacheClient.invalidateVendorRates(vendorId);

      expect(result).toBe(0); // Graceful degradation
    });
  });

  describe('Health Check', () => {
    it('returns true on successful ping', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await cacheClient.healthCheck();

      expect(result).toBe(true);
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('returns false on ping failure', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await cacheClient.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('Cache Statistics', () => {
    it('returns stats for vendor cache keys', async () => {
      const vendorId = 123;

      mockRedisClient.scan
        .mockResolvedValueOnce({
          cursor: 0,
          keys: ['key1', 'key2', 'key3'],
        });

      const result = await cacheClient.getStats(vendorId);

      expect(result.vendorId).toBe(vendorId);
      expect(result.keyCount).toBe(3);
      expect(result.keys).toEqual(['key1', 'key2', 'key3']);
    });
  });
});
