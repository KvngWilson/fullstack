/**
 * ShippingCacheService - Domain-level shipping rate cache orchestration
 * 
 * Coordinates between:
 * - ShippingCacheClient (Redis operations)
 * - EasyshipGateway (API calls)
 * - Business logic (rate validation, tenant isolation)
 */

const logger = require('../../../shared/utils/logger');
const { InvalidShippingRequest } = require('../../../shared/utils/errors');

class ShippingCacheService {
  constructor(cacheClient, easyshipGateway) {
    this.cache = cacheClient;
    this.gateway = easyshipGateway;
  }

  /**
   * Get shipping rates with caching
   * 
   * Flow:
   * 1. Check tenant context (vendor_id must be set)
   * 2. Check cache (using cart + address hash)
   * 3. If miss, call Easyship gateway
   * 4. Normalize and validate response
   * 5. Cache result
   * 6. Return rates
   */
  async getShippingRates(params) {
    const {
      vendorId,
      cartItems,
      address,
      currency = 'USD',
      apiKey = null,
    } = params;

    // Tenant isolation: require vendor context
    if (!vendorId) {
      throw new InvalidShippingRequest('Vendor context required for shipping rates');
    }

    // Validate inputs
    this._validateRateRequest({ cartItems, address });

    try {
      // Try cache first
      const cached = await this.cache.getCachedRates(
        vendorId,
        cartItems,
        address,
        currency
      );

      if (cached) {
        logger.debug('Returning cached shipping rates', {
          vendorId,
          rateCount: cached.rates.length,
        });
        return cached.rates;
      }

      // Cache miss: fetch from Easyship
      logger.debug('Fetching fresh shipping rates from Easyship', { vendorId });

      const rates = await this.gateway.getRates({
        destination: address,
        items: cartItems,
        origin: null, // Uses gateway default
        vendorId,
        apiKey,
      });

      // Validate rates before caching
      const validRates = this._validateRates(rates);

      // Cache the rates
      await this.cache.setCachedRates(
        vendorId,
        cartItems,
        address,
        currency,
        validRates
      );

      logger.info('Shipping rates fetched and cached', {
        vendorId,
        rateCount: validRates.length,
      });

      return validRates;
    } catch (error) {
      logger.error('Shipping rate fetch failed', {
        vendorId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate rate request parameters
   */
  _validateRateRequest({ cartItems, address }) {
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      throw new InvalidShippingRequest('Cart must contain at least one item');
    }

    const requiredAddressFields = ['country_code', 'city', 'postal_code', 'state'];
    const missingFields = requiredAddressFields.filter(f => !address[f]);

    if (missingFields.length > 0) {
      throw new InvalidShippingRequest(
        `Invalid address: missing ${missingFields.join(', ')}`
      );
    }
  }

  /**
   * Validate rates returned from gateway
   * Ensures all rates have required fields
   */
  _validateRates(rates) {
    return (rates || []).filter(rate => {
      const required = [
        'easyshipRateId',
        'courierId',
        'courierName',
        'totalChargeMinor',
        'currency',
      ];

      const hasAll = required.every(field => rate[field] !== undefined && rate[field] !== null);

      if (!hasAll) {
        logger.warn('Skipping invalid rate from Easyship', { rate });
      }

      return hasAll;
    });
  }

  /**
   * Invalidate cached rates (called on order changes, vendor config updates)
   */
  async invalidateCache(vendorId) {
    if (!vendorId) {
      throw new InvalidShippingRequest('Vendor context required');
    }

    const deleted = await this.cache.invalidateVendorRates(vendorId);
    logger.info('Shipping cache invalidated', { vendorId, keysDeleted: deleted });
    return deleted;
  }

  /**
   * Get cache hit statistics for a vendor (monitoring)
   */
  async getCacheStats(vendorId) {
    if (!vendorId) {
      throw new InvalidShippingRequest('Vendor context required');
    }

    return this.cache.getStats(vendorId);
  }
}

module.exports = ShippingCacheService;
