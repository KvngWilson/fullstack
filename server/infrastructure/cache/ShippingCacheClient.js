/**
 * ShippingCacheClient - Redis-backed shipping rate cache
 *
 * Strategy:
 * - Cache key: rates:{vendorId}:{hash(cart+address+currency)}
 * - TTL: 10-15 minutes for valid rates, 2 min for empty results
 * - Tenant isolation: vendorId in key prevents cross-tenant leaks
 * - Auto-invalidation on cart/address changes
 */

const crypto = require("crypto");
const logger = require("../../shared/utils/logger");

class ShippingCacheClient {
  constructor(redisClient) {
    this.client = redisClient;
    this.RATES_TTL = 900; // 15 minutes
    this.EMPTY_RESULTS_TTL = 120; // 2 minutes
  }

  /**
   * Generate cache key hash from cart items, address, and currency
   * Ensures any change invalidates the cache
   */
  _generateCacheKeyHash(cartItems, address, currency) {
    const cacheData = {
      items: cartItems.map((item) => ({
        variantId: item.product_variant_id,
        quantity: item.quantity,
        weight: item.weight || 0.5,
        dimensions: {
          height: item.height || 10,
          width: item.width || 10,
          length: item.length || 10,
        },
      })),
      address: {
        country: address.country_code,
        state: address.state,
        city: address.city,
        postalCode: address.postal_code,
      },
      currency,
    };

    const dataString = JSON.stringify(cacheData);
    return crypto.createHash("sha256").update(dataString).digest("hex");
  }

  /**
   * Generate full cache key with vendor isolation
   */
  _getCacheKey(vendorId, cartHash) {
    return `shipping:rates:${vendorId}:${cartHash}`;
  }

  /**
   * Get cached shipping rates or null if expired/missing
   */
  async getCachedRates(vendorId, cartItems, address, currency) {
    try {
      const cartHash = this._generateCacheKeyHash(cartItems, address, currency);
      const cacheKey = this._getCacheKey(vendorId, cartHash);

      const cached = await this.client.get(cacheKey);

      if (cached) {
        logger.debug("Shipping rates cache hit", {
          vendorId,
          cacheKey,
        });
        return JSON.parse(cached);
      }

      logger.debug("Shipping rates cache miss", { vendorId, cacheKey });
      return null;
    } catch (error) {
      logger.error("Cache retrieval error", { error: error.message });
      return null; // Graceful degradation
    }
  }

  /**
   * Cache shipping rates with appropriate TTL
   */
  async setCachedRates(vendorId, cartItems, address, currency, rates) {
    try {
      const cartHash = this._generateCacheKeyHash(cartItems, address, currency);
      const cacheKey = this._getCacheKey(vendorId, cartHash);

      // Empty results get shorter TTL
      const ttl =
        rates && rates.length > 0 ? this.RATES_TTL : this.EMPTY_RESULTS_TTL;

      await this.client.setEx(
        cacheKey,
        ttl,
        JSON.stringify({
          rates: rates || [],
          cachedAt: new Date().toISOString(),
          vendorId,
        }),
      );

      logger.debug("Shipping rates cached", {
        vendorId,
        cacheKey,
        ttl,
        rateCount: rates ? rates.length : 0,
      });
    } catch (error) {
      logger.error("Cache set error", { error: error.message });
      // Graceful degradation - cache failure doesn't block functionality
    }
  }

  /**
   * Invalidate all rates for a vendor (e.g., when they update shipping config)
   */
  async invalidateVendorRates(vendorId) {
    try {
      // Pattern: shipping:rates:{vendorId}:*
      const pattern = `shipping:rates:${vendorId}:*`;

      // Redis SCAN for pattern matching (safe for large keyspaces)
      let cursor = 0;
      let deleted = 0;

      do {
        const result = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = result.cursor;

        if (result.keys.length > 0) {
          deleted += await this.client.del(...result.keys);
        }
      } while (cursor !== 0);

      logger.info("Vendor shipping rates invalidated", {
        vendorId,
        keysDeleted: deleted,
      });

      return deleted;
    } catch (error) {
      logger.error("Cache invalidation error", { error: error.message });
      return 0;
    }
  }

  /**
   * Invalidate rates for specific user address change
   * Conservative approach: invalidate all user's caches
   */
  async invalidateUserRates(vendorId) {
    return this.invalidateVendorRates(vendorId);
  }

  /**
   * Health check for cache connectivity
   */
  async healthCheck() {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error("Cache health check failed", { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics (debug/monitoring)
   */
  async getStats(vendorId) {
    try {
      const pattern = `shipping:rates:${vendorId}:*`;
      let cursor = 0;
      let stats = {
        vendorId,
        keyCount: 0,
        keys: [],
      };

      do {
        const result = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = result.cursor;
        stats.keyCount += result.keys.length;
        stats.keys.push(...result.keys);
      } while (cursor !== 0);

      return stats;
    } catch (error) {
      logger.error("Cache stats error", { error: error.message });
      return { vendorId, keyCount: 0, keys: [] };
    }
  }
}

module.exports = ShippingCacheClient;
