/**
 * RateLimiter - Token bucket rate limiting algorithm
 * 
 * Prevents overwhelming downstream services by:
 * - Allowing bursts up to capacity
 * - Refreshing tokens at a steady rate
 * - Queuing requests when over limit
 * - Rejecting requests if queue full
 * 
 * Use case: API calls to Easyship, per-vendor limits
 */

const logger = require('../../shared/utils/logger');

class RateLimiter {
  /**
   * @param {object} config
   * @param {number} config.capacity - Max tokens (default: 100)
   * @param {number} config.refillRate - Tokens added per second (default: 10)
   * @param {number} config.maxWaitTime - Max time to wait for token (default: 5000ms)
   * @param {string} config.name - Name for logging
   */
  constructor(config = {}) {
    this.capacity = config.capacity || 100;
    this.refillRate = config.refillRate || 10; // tokens per second
    this.maxWaitTime = config.maxWaitTime || 5000;
    this.name = config.name || 'RateLimiter';

    this.tokens = this.capacity;
    this.lastRefillTime = Date.now();
    this.waitQueue = [];
  }

  /**
   * Try to acquire a token
   * Returns immediately if token available, otherwise queues request
   * 
   * @returns {Promise<boolean>} - Resolves to true if token acquired, false if rejected
   */
  async acquireToken() {
    // Refill tokens based on elapsed time
    this._refillTokens();

    // Try immediate acquisition
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }

    // Queue request for later
    return new Promise((resolve, reject) => {
      const watchtimer = setTimeout(() => {
        // Remove from queue if timeout
        const index = this.waitQueue.indexOf(resolver);
        if (index > -1) {
          this.waitQueue.splice(index, 1);
        }

        logger.warn(`${this.name}: Token request timeout`, {
          queueLength: this.waitQueue.length,
          tokens: this.tokens,
        });

        reject(new Error(`${this.name}: Rate limit exceeded`));
      }, this.maxWaitTime);

      const resolver = () => {
        clearTimeout(watchtimer);
        this.tokens--;
        resolve(true);
      };

      this.waitQueue.push(resolver);
    });
  }

  /**
   * Process waiting requests when tokens available
   * @private
   */
  _processWaitQueue() {
    while (this.tokens > 0 && this.waitQueue.length > 0) {
      const nextResolver = this.waitQueue.shift();
      nextResolver();
    }
  }

  /**
   * Refill tokens based on elapsed time
   * @private
   */
  _refillTokens() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTime) / 1000;
    const tokensToAdd = Math.floor(elapsedSeconds * this.refillRate);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefillTime = now;

      // Process any waiting requests
      this._processWaitQueue();
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      tokens: this.tokens,
      capacity: this.capacity,
      refillRate: this.refillRate,
      queueLength: this.waitQueue.length,
      lastRefillTime: this.lastRefillTime,
    };
  }

  /**
   * Reset limiter (useful for testing)
   */
  reset() {
    this.tokens = this.capacity;
    this.lastRefillTime = Date.now();
    this.waitQueue = [];
    logger.info(`${this.name}: Rate limiter reset`, {
      tokens: this.tokens,
      capacity: this.capacity,
    });
  }
}

module.exports = RateLimiter;
