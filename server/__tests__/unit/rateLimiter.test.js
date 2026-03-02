/**
 * RateLimiter Unit Tests
 * 
 * Tests token bucket rate limiting:
 * - Token acquisition
 * - Token refill over time
 * - Queue handling
 * - Timeout on queue full
 */

const RateLimiter = require('../../infrastructure/resilience/RateLimiter');

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      capacity: 10,
      refillRate: 5, // 5 tokens per second
      maxWaitTime: 1000,
      name: 'TestLimiter',
    });
  });

  afterEach(() => {
    // Clean up any pending timers
    if (limiter) {
      limiter.reset();
    }
  });

  describe('Token acquisition', () => {
    it('acquires token immediately when available', async () => {
      const result = await limiter.acquireToken();

      expect(result).toBe(true);
      expect(limiter.getState().tokens).toBe(9);
    });

    it('decrements token count', async () => {
      const initialTokens = limiter.getState().tokens;

      await limiter.acquireToken();
      await limiter.acquireToken();
      await limiter.acquireToken();

      expect(limiter.getState().tokens).toBe(initialTokens - 3);
    });

    it('acquires all capacity tokens', async () => {
      const capacity = limiter.getState().capacity;

      for (let i = 0; i < capacity; i++) {
        const result = await limiter.acquireToken();
        expect(result).toBe(true);
      }

      expect(limiter.getState().tokens).toBe(0);
    });

    it('queues request when no tokens available', async () => {
      // Use all tokens
      const capacity = limiter.getState().capacity;
      for (let i = 0; i < capacity; i++) {
        await limiter.acquireToken();
      }

      expect(limiter.getState().tokens).toBe(0);
      expect(limiter.getState().queueLength).toBe(0);

      // Next request should queue with short timeout
      const quickTimeoutLimiter = new RateLimiter({
        capacity: 1,
        refillRate: 0.01, // Very slow refill
        maxWaitTime: 200, // 200ms timeout
      });

      // Use the token
      await quickTimeoutLimiter.acquireToken();

      // This request will timeout
      await expect(quickTimeoutLimiter.acquireToken()).rejects.toThrow(
        /Rate limit exceeded/
      );
    });
  });

  describe('Token refill', () => {
    it('refills tokens over time', async () => {
      // Use some tokens
      await limiter.acquireToken();
      await limiter.acquireToken();

      const beforeRefill = limiter.getState().tokens;

      // Wait for refill (1 second = 5 tokens at 5/sec rate)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Trigger refill by acquiring token
      await limiter.acquireToken();

      const afterRefill = limiter.getState().tokens;

      // Should have refilled approximately 5 tokens (minus 1 acquired)
      expect(afterRefill).toBeGreaterThan(beforeRefill);
    });

    it('does not exceed capacity after refill', async () => {
      const capacity = limiter.getState().capacity;

      // Wait for refill
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Trigger refill
      await limiter.acquireToken();

      expect(limiter.getState().tokens).toBeLessThanOrEqual(capacity);
    });

    it('allows requests after token refill', async () => {
      // Use all tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquireToken();
      }

      expect(limiter.getState().tokens).toBe(0);

      // Wait for tokens to refill
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be able to acquire tokens now
      const result = await limiter.acquireToken();
      expect(result).toBe(true);
      expect(limiter.getState().tokens).toBeLessThan(10);
    });
  });

  describe('Queue management', () => {
    it('tracks queue length', async () => {
      const quickLimiter = new RateLimiter({
        capacity: 1,
        refillRate: 1, // 1 token per second
        maxWaitTime: 2000,
      });

      // Use all tokens
      await quickLimiter.acquireToken();

      // Queue multiple requests
      const promises = [
        quickLimiter.acquireToken(),
        quickLimiter.acquireToken(),
      ];

      expect(quickLimiter.getState().queueLength).toBe(2);

      // Wait for refill but requests will timeout
      await new Promise((resolve) => setTimeout(resolve, 50));

      // At this point queue should still exist
      expect(quickLimiter.getState().queueLength).toBeGreaterThan(0);
    });

    it('rejects request on timeout', async () => {
      const limiterWithShortTimeout = new RateLimiter({
        capacity: 1,
        refillRate: 0.01, // Very slow refill
        maxWaitTime: 100, // 100ms timeout
        name: 'SlowLimiter',
      });

      // Use the token
      await limiterWithShortTimeout.acquireToken();

      // Queue request that will timeout
      await expect(limiterWithShortTimeout.acquireToken()).rejects.toThrow();
    });
  });

  describe('State management', () => {
    it('returns current state', () => {
      const state = limiter.getState();

      expect(state).toHaveProperty('tokens');
      expect(state).toHaveProperty('capacity');
      expect(state).toHaveProperty('refillRate');
      expect(state).toHaveProperty('queueLength');
    });

    it('resets limiter', async () => {
      // Use tokens
      for (let i = 0; i < 5; i++) {
        await limiter.acquireToken();
      }

      expect(limiter.getState().tokens).toBe(5);

      limiter.reset();

      expect(limiter.getState().tokens).toBe(10);
      expect(limiter.getState().queueLength).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('acquires multiple tokens from capacity', async () => {
      const capacity = limiter.getState().capacity;

      for (let i = 0; i < Math.floor(capacity * 0.8); i++) {
        const result = await limiter.acquireToken();
        expect(result).toBe(true);
      }

      expect(limiter.getState().tokens).toBeLessThan(capacity);
    });

    it('queues and rejects on timeout', async () => {
      const strictLimiter = new RateLimiter({
        capacity: 1,
        refillRate: 0.001, // Very slow
        maxWaitTime: 200, // Short timeout
      });

      // Use the token
      await strictLimiter.acquireToken();

      // This will timeout
      await expect(strictLimiter.acquireToken()).rejects.toThrow(
        /Rate limit exceeded/
      );
    });
  });
});
