/**
 * Exchange Rate Service
 *
 * Manages currency exchange rates with caching, locking for orders,
 * and support for historical rates.
 *
 * Caching Strategy:
 * - Redis cache for realtime rates (1 hour TTL by default)
 * - Database fallback if cache miss
 * - Locked rates for orders (immutable)
 */


const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "KWD",
  "BHD",
  "OMR",
  "JOD",
  "TND",
  "IQD",
  "INR",
  "CNY",
  "MXN",
  "BRL",
  "ZAR",
  "NGN",
];
const { logger } = require('../../../shared/utils/logger');

const CACHE_TTL = 3600; // 1 hour in seconds
const CACHE_PREFIX = "exchange_rate:";
const LOCK_PREFIX = "exchange_rate_lock:";
const RATE_SCALE = 1_0000_0000;

function toScaledRate(rate) {
  return Math.round(Number(rate) * RATE_SCALE);
}

class ExchangeRateService {
  /**
   * Initialize the exchange rate service
   * @param {object} dbPool - Database connection pool
   * @param {object} redisClient - Redis client for caching
   */
  constructor(dbPool, redisClient, options = {}) {
    this.dbPool = dbPool;
    this.redis = redisClient;
    this.cacheTTL = options.cacheTTL || CACHE_TTL;
    this.cacheStats = {
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Validate currency code
   * @param {string} currency - Currency code to validate
   * @throws {Error} if currency is invalid
   */
  validateCurrency(currency) {
    if (!currency || typeof currency !== "string") {
      throw new Error("Invalid currency code");
    }
    const upper = currency.toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(upper)) {
      throw new Error(`Invalid currency code: ${currency}`);
    }
    return upper;
  }

  /**
   * Get exchange rate between two currencies
   * Attempts cache first, then database, then external provider
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Promise<number>} Exchange rate with 8 decimal precision
   * @throws {Error} if currencies are invalid or same
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    const from = this.validateCurrency(fromCurrency);
    const to = this.validateCurrency(toCurrency);

    // Prevent same-to-same conversion
    if (from === to) {
      throw new Error("Cannot convert currency to itself");
    }

    const cacheKey = `${CACHE_PREFIX}${from}:${to}`;

    try {
      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        this.cacheStats.hits++;
        return Number(cached);
      }

      this.cacheStats.misses++;

      // Cache miss: fetch from database
      const result = await this.dbPool.query(
        `SELECT rate, expires_at FROM exchange_rates
         WHERE from_currency = $1 AND to_currency = $2 AND expires_at > NOW()
         ORDER BY expires_at DESC LIMIT 1`,
        [from, to],
      );

      if (result.rows.length === 0) {
        throw new Error(`No exchange rate found for ${from}/${to}`);
      }

      const rate = Number(result.rows[0].rate);

      // Cache the rate with appropriate TTL
      const ttl = this.calculateTTL(result.rows[0].expires_at);
      await this.redis.set(
        cacheKey,
        rate.toFixed(8),
        { EX: Math.max(ttl, 1) }, // Minimum 1 second TTL
      );

      return rate;
    } catch (error) {
      if (error.message.includes("No exchange rate found")) {
        throw error;
      }
      // Log database/Redis errors but propagate
      logger.error('Exchange rate service error', { error: error.message });
      throw error;
    }
  }

  /**
   * Convert an amount from one currency to another
   * @param {number} minorUnits - Amount in minor units (cents, etc)
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Promise<number>} Converted amount in minor units (integer)
   * @throws {Error} if amount is invalid or conversion fails
   */
  async convertCurrency(minorUnits, fromCurrency, toCurrency) {
    // Validate amount
    if (!Number.isInteger(minorUnits) || minorUnits < 0) {
      throw new Error("Amount must be a non-negative integer in minor units");
    }

    const from = this.validateCurrency(fromCurrency);
    const to = this.validateCurrency(toCurrency);

    // Same currency: return as-is
    if (from === to) {
      return minorUnits;
    }

    // Get exchange rate
    const rate = await this.getExchangeRate(from, to);

    // Precision-safe conversion in fixed-point space.
    const scaledRate = toScaledRate(rate);
    const converted = Math.round((minorUnits * scaledRate) / RATE_SCALE);

    return converted;
  }

  /**
   * Lock an exchange rate for an order
   * Once locked, the rate for an order cannot be changed (immutable)
   * @param {string} orderId - Order ID
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @param {number} rate - Exchange rate to lock
   * @param {string} minorUnitsAmount - Original amount in minor units (for audit)
   * @returns {Promise<object>} Locked rate info {orderId, rate, lockedAt}
   * @throws {Error} if rate already locked for this order
   */
  async lockExchangeRate(
    orderId,
    fromCurrency,
    toCurrency,
    rate,
    minorUnitsAmount,
  ) {
    const from = this.validateCurrency(fromCurrency);
    const to = this.validateCurrency(toCurrency);

    if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
      throw new Error("Invalid exchange rate: must be positive number");
    }

    if (!orderId || typeof orderId !== "string") {
      throw new Error("Invalid order ID");
    }

    const lockKey = `${LOCK_PREFIX}${orderId}`;
    const lockedAt = new Date();

    try {
      // Check if already locked (prevent double-lock)
      const existing = await this.redis.get(lockKey);
      if (existing !== null) {
        throw new Error(`Exchange rate already locked for order ${orderId}`);
      }

      // Store locked rate in database
      await this.dbPool.query(
        `INSERT INTO order_exchange_rates 
         (order_id, from_currency, to_currency, rate, locked_at, original_amount)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (order_id) DO NOTHING`,
        [orderId, from, to, rate, lockedAt, minorUnitsAmount || 0],
      );

      // Cache lock info in Redis (prevents double-locking even if DB is slow)
      // Keep locked rate for much longer than regular rates
      const lockData = JSON.stringify({ rate, lockedAt });
      await this.redis.set(
        lockKey,
        lockData,
        { EX: 86400 * 30 }, // 30 days
      );

      return {
        orderId,
        rate,
        lockedAt,
      };
    } catch (error) {
      throw new Error(`Failed to lock exchange rate: ${error.message}`);
    }
  }

  /**
   * Get a locked exchange rate for an order
   * @param {string} orderId - Order ID
   * @returns {Promise<object|null>} Locked rate info or null if not exists
   */
  async getLockedRate(orderId) {
    if (!orderId || typeof orderId !== "string") {
      throw new Error("Invalid order ID");
    }

    const lockKey = `${LOCK_PREFIX}${orderId}`;

    try {
      // Try cache first
      const cached = await this.redis.get(lockKey);
      if (cached !== null) {
        return JSON.parse(cached);
      }

      // Try database
      const result = await this.dbPool.query(
        `SELECT rate, locked_at FROM order_exchange_rates WHERE order_id = $1`,
        [orderId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const lockData = {
        rate: Number(result.rows[0].rate),
        lockedAt: result.rows[0].locked_at,
      };

      // Cache for future lookups
      await this.redis.set(
        lockKey,
        JSON.stringify(lockData),
        { EX: 86400 * 30 }, // 30 days
      );

      return lockData;
    } catch (error) {
      logger.error('Error retrieving locked rate', { error: error.message });
      return null;
    }
  }

  /**
   * Get historical exchange rate for a specific date
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @param {Date} date - Date to get rate for
   * @returns {Promise<number|null>} Historical rate or null if not found
   */
  async getHistoricalRate(fromCurrency, toCurrency, date) {
    const from = this.validateCurrency(fromCurrency);
    const to = this.validateCurrency(toCurrency);

    if (!(date instanceof Date) || isNaN(date)) {
      throw new Error("Invalid date");
    }

    const cacheKey = `${CACHE_PREFIX}${from}:${to}:${date.toISOString().split("T")[0]}`;

    try {
      // Check cache
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        this.cacheStats.hits++;
        return Number(cached);
      }

      this.cacheStats.misses++;

      // Query database for rate on or before the given date
      const result = await this.dbPool.query(
        `SELECT rate FROM exchange_rates 
         WHERE from_currency = $1 AND to_currency = $2
         AND DATE(effective_date) <= $3
         ORDER BY effective_date DESC LIMIT 1`,
        [from, to, date],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const rate = Number(result.rows[0].rate);

      // Cache for 30 days (historical data doesn't change)
      await this.redis.set(cacheKey, rate.toFixed(8), { EX: 86400 * 30 });

      return rate;
    } catch (error) {
      logger.error('Error getting historical rate', { error: error.message });
      return null;
    }
  }

  /**
   * Refresh cached exchange rates for all active currency pairs
   * Called periodically to update cache
   * @returns {Promise<number>} Number of rates refreshed
   */
  async refreshCachedRates() {
    let refreshed = 0;

    try {
      // Get all active currency pairs
      const result = await this.dbPool.query(
        `SELECT DISTINCT from_currency, to_currency FROM exchange_rates
         WHERE expires_at > NOW()
         ORDER BY from_currency, to_currency`,
      );

      // Refresh each rate
      for (const row of result.rows) {
        try {
          // Force a fresh fetch
          const rate = await this.getExchangeRate(
            row.from_currency,
            row.to_currency,
          );
          refreshed++;
        } catch (error) {
          logger.warn('Failed to refresh rate', {
            pair: `${row.from_currency}/${row.to_currency}`,
            error: error.message,
          });
        }
      }

      return refreshed;
    } catch (error) {
      logger.error('Failed to refresh cached rates', { error: error.message });
      return 0;
    }
  }

  /**
   * Calculate TTL for cache based on rate expiry time
   * @param {Date} expiresAt - When the rate expires
   * @returns {number} TTL in seconds
   */
  calculateTTL(expiresAt) {
    const now = new Date();
    const expiryTime = new Date(expiresAt);
    const ttlSeconds = Math.floor((expiryTime - now) / 1000);

    // Minimum 60 seconds, maximum configured cache TTL
    return Math.min(Math.max(ttlSeconds, 60), this.cacheTTL);
  }

  getCacheTTL() {
    return this.cacheTTL;
  }

  /**
   * Get cache statistics
   * @returns {object} {hits, misses, hitRatio}
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRatio: total > 0 ? this.cacheStats.hits / total : 0,
    };
  }

  /**
   * Clear cache (for testing or maintenance)
   * @returns {Promise<void>}
   */
  async clearCache() {
    // Get all exchange rate keys and delete them
    const keys = await this.redis.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Validate that two currency amounts match before combining
   * Used in checkout to prevent accidental currency mixing
   * @param {string} currency1 - First currency
   * @param {string} currency2 - Second currency
   * @returns {boolean} true if currencies match
   */
  currenciesMatch(currency1, currency2) {
    return (
      this.validateCurrency(currency1) === this.validateCurrency(currency2)
    );
  }
}

module.exports = ExchangeRateService;
