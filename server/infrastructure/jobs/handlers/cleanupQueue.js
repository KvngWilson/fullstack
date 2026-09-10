const { logger } = require("../../../shared/utils/logger");

class CleanupQueue {
  constructor(queue, dbPool, redisClient) {
    this.queue = queue;
    this.dbPool = dbPool;
    this.redisClient = redisClient;
    this.setupProcessor();
  }

  setupProcessor() {
    this.queue.process(async (job) => {
      const { type, olderThanDays = 7 } = job.data || {};

      logger.info("Processing cleanup job", {
        jobId: job.id,
        type,
        olderThanDays,
        attempt: job.attemptsMade + 1,
      });

      const result = await this.handle(type, { olderThanDays, ...job.data });

      logger.info("Cleanup job completed", {
        jobId: job.id,
        type,
      });

      return result;
    });
  }

  async handle(type, payload = {}) {
    switch (type) {
      case "expired-idempotency-keys":
        return this.cleanupIdempotencyKeys();
      case "stale-websocket-sessions":
        return this.cleanupWebSocketSessions(payload.olderThanDays);
      case "analytics-snapshots":
        return this.cleanupAnalyticsSnapshots(payload.olderThanDays);
      case "analytics-cache":
        return this.cleanupRedisPattern("analytics:*");
      case "shipping-cache":
        return this.cleanupRedisPattern("shipping:rates:*");
      case "exchange-rate-cache":
        return this.cleanupRedisPattern("exchange_rate:*", "exchange_rate_lock:*");
      default:
        throw new Error(`Unsupported cleanup job type: ${type}`);
    }
  }

  async queueCleanup(type, payload = {}, options = {}) {
    return this.queue.add(
      { type, ...payload },
      {
        jobId: `cleanup:${type}:${Date.now()}`,
        priority: 1,
        ...options,
      },
    );
  }

  async cleanupIdempotencyKeys() {
    const result = await this.dbPool.query(
      `DELETE FROM idempotency_keys
       WHERE expires_at <= NOW()
       RETURNING id`,
    );

    return { deleted: result.rowCount, type: "expired-idempotency-keys" };
  }

  async cleanupWebSocketSessions(olderThanDays = 7) {
    const days = Math.max(1, Number(olderThanDays) || 7);
    const result = await this.dbPool.query(
      `DELETE FROM websocket_sessions
       WHERE is_active = false
         AND disconnected_at IS NOT NULL
         AND disconnected_at < NOW() - ($1 || ' days')::interval
       RETURNING id`,
      [days],
    );

    return { deleted: result.rowCount, type: "stale-websocket-sessions" };
  }

  async cleanupAnalyticsSnapshots(olderThanDays = 90) {
    const days = Math.max(1, Number(olderThanDays) || 90);
    const result = await this.dbPool.query(
      `DELETE FROM analytics_snapshots
       WHERE created_at < NOW() - ($1 || ' days')::interval
       RETURNING id`,
      [days],
    );

    return { deleted: result.rowCount, type: "analytics-snapshots" };
  }

  async cleanupRedisPattern(...patterns) {
    let deleted = 0;

    for (const pattern of patterns) {
      deleted += await this._deletePattern(pattern);
    }

    return { deleted, type: "redis-cache", patterns };
  }

  async _deletePattern(pattern) {
    if (!this.redisClient?.scan) {
      return 0;
    }

    let cursor = 0;
    let deleted = 0;

    do {
      const result = await this.redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = Number(result.cursor);

      if (result.keys.length > 0) {
        deleted += await this.redisClient.del(...result.keys);
      }
    } while (cursor !== 0);

    logger.info("Cleanup cache pattern processed", { pattern, deleted });
    return deleted;
  }
}

module.exports = CleanupQueue;
