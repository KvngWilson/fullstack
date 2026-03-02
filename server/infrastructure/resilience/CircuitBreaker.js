/**
 * CircuitBreaker - Pattern for handling cascading failures
 * 
 * States:
 * - CLOSED (normal): Requests pass through, failures are counted
 * - OPEN (failing): Requests fail fast without calling service
 * - HALF_OPEN (recovering): Attempts to test if service recovered
 * 
 * Prevents overwhelming failing services and enables graceful degradation
 */

const logger = require('../../shared/utils/logger');

const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreaker {
  /**
   * @param {object} config
   * @param {number} config.failureThreshold - Failures before opening (default: 5)
   * @param {number} config.successThreshold - Successes before closing from half-open (default: 2)
   * @param {number} config.timeout - Time in ms before trying to half-open (default: 60000)
   * @param {string} config.name - Circuit breaker name for logging
   */
  constructor(config = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.successThreshold = config.successThreshold || 2;
    this.timeout = config.timeout || 60000; // 60 seconds
    this.name = config.name || 'CircuitBreaker';

    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Execute function with circuit breaker protection
   * 
   * @param {Function} fn - Async function to execute
   * @param {Function} fallback - Optional fallback function if circuit open
   * @returns {Promise} - Result or error/fallback result
   */
  async execute(fn, fallback) {
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        // Circuit still open, reject immediately
        logger.warn(`${this.name}: Circuit OPEN, rejecting request`, {
          state: this.state,
          failureCount: this.failureCount,
          nextAttemptIn: this.nextAttemptTime - Date.now(),
        });

        if (fallback) {
          return fallback();
        }

        throw new Error(
          `${this.name}: Circuit breaker is OPEN. Service unavailable.`
        );
      } else {
        // Time to try recovery
        this.state = CIRCUIT_STATES.HALF_OPEN;
        this.successCount = 0;
        logger.info(`${this.name}: Transitioning to HALF_OPEN, testing recovery`, {
          state: this.state,
        });
      }
    }

    try {
      const result = await fn();

      if (this.state === CIRCUIT_STATES.HALF_OPEN) {
        this.successCount++;

        if (this.successCount >= this.successThreshold) {
          this.state = CIRCUIT_STATES.CLOSED;
          this.failureCount = 0;
          this.successCount = 0;
          logger.info(`${this.name}: Circuit CLOSED, recovered successfully`, {
            state: this.state,
          });
        }
      } else {
        // CLOSED state
        this.failureCount = Math.max(0, this.failureCount - 1); // Reduce failure count on success
      }

      return result;
    } catch (error) {
      this.recordFailure();

      if (fallback) {
        logger.warn(`${this.name}: Executing fallback due to error`, {
          error: error.message,
          state: this.state,
        });
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Record a failure
   * @private
   */
  recordFailure() {
    this.lastFailureTime = Date.now();

    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      // Failure during recovery, reopen circuit
      this.state = CIRCUIT_STATES.OPEN;
      this.nextAttemptTime = Date.now() + this.timeout;
      logger.error(`${this.name}: Recovery failed, circuit OPEN`, {
        state: this.state,
        nextAttemptIn: this.timeout,
      });
    } else if (this.state === CIRCUIT_STATES.CLOSED) {
      this.failureCount++;

      if (this.failureCount >= this.failureThreshold) {
        this.state = CIRCUIT_STATES.OPEN;
        this.nextAttemptTime = Date.now() + this.timeout;
        logger.error(
          `${this.name}: Threshold exceeded, circuit OPEN`,
          {
            state: this.state,
            failureCount: this.failureCount,
            threshold: this.failureThreshold,
            nextAttemptIn: this.timeout,
          }
        );
      }
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Reset circuit breaker (useful for testing)
   */
  reset() {
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    logger.info(`${this.name}: Circuit reset to CLOSED`);
  }
}

module.exports = CircuitBreaker;
module.exports.STATES = CIRCUIT_STATES;
