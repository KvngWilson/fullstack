/**
 * JobQueueService - Redis-backed job queue with retry logic
 * 
 * Supports:
 * - Async job processing (e.g., shipment creation, webhook retries)
 * - Exponential backoff retry strategy
 * - Job state tracking (pending, processing, completed, failed)
 * - Dead-letter queue for permanently failed jobs
 * - Per-vendor isolation
 */

const logger = require('../../shared/utils/logger');

class JobQueueService {
  /**
   * @param {object} redisClient - Redis client
   * @param {object} config
   * @param {number} config.maxRetries - Max retry attempts (default: 3)
   * @param {number} config.baseDelayMs - Base delay before first retry (default: 1000)
   * @param {number} config.backoffMultiplier - Exponential backoff multiplier (default: 2)
   */
  constructor(redisClient, config = {}) {
    this.redis = redisClient;
    this.maxRetries = config.maxRetries || 3;
    this.baseDelayMs = config.baseDelayMs || 1000;
    this.backoffMultiplier = config.backoffMultiplier || 2;
  }

  /**
   * Enqueue a job for processing
   * 
   * @param {string} jobType - Job type identifier (e.g., 'shipment:create', 'webhook:retry')
   * @param {object} jobData - Job payload
   * @param {object} options
   * @param {number} options.vendorId - Vendor/tenant ID
   * @param {number} options.delayMs - Delay before processing (default: 0)
   * @returns {Promise<string>} - Job ID
   */
  async enqueueJob(jobType, jobData, options = {}) {
    const jobId = `job:${jobType}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const vendorId = options.vendorId || 'system';
    const delayMs = options.delayMs || 0;

    const job = {
      id: jobId,
      type: jobType,
      vendorId,
      data: jobData,
      status: 'pending',
      retryCount: 0,
      maxRetries: this.maxRetries,
      createdAt: Date.now(),
      attemptedAt: null,
      error: null,
    };

    try {
      // Store job in Redis hash
      await this.redis.hset(jobId, 'payload', JSON.stringify(job));
      await this.redis.hset(jobId, 'status', 'pending');

      // Add to queue at appropriate time
      const queueKey = `queue:${jobType}:${vendorId}`;
      const scheduledTime = Date.now() + delayMs;

      // Use sorted set for scheduled jobs (score = scheduled time)
      await this.redis.zadd(queueKey, scheduledTime, jobId);

      logger.info('Job enqueued', {
        jobId,
        jobType,
        vendorId,
        delayMs,
      });

      return jobId;
    } catch (error) {
      logger.error('Failed to enqueue job', {
        jobType,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Dequeue and process job
   * 
   * @param {string} jobType - Job type to process
   * @param {number} vendorId - Vendor to process jobs for
   * @param {Function} handler - Async function to handle job
   * @returns {Promise<object>} - Job result { success, jobId, result?, error? }
   */
  async processJob(jobType, vendorId, handler) {
    const queueKey = `queue:${jobType}:${vendorId}`;
    const now = Date.now();

    try {
      // Get next pending job (by scheduled time)
      const jobIds = await this.redis.zrangebyscore(
        queueKey,
        '-inf',
        now,
        'LIMIT',
        0,
        1
      );

      if (jobIds.length === 0) {
        return { success: false, reason: 'no_jobs' };
      }

      const jobId = jobIds[0];

      // Lock job (prevent concurrent processing)
      const lockKey = `lock:${jobId}`;
      const locked = await this.redis.set(lockKey, '1', 'EX', 30, 'NX');

      if (!locked) {
        return { success: false, reason: 'locked', jobId };
      }

      try {
        // Fetch job payload
        const jobPayload = await this.redis.hget(jobId, 'payload');
        const job = JSON.parse(jobPayload);

        logger.info('Processing job', {
          jobId: job.id,
          jobType: job.type,
          attemptNumber: job.retryCount + 1,
        });

        job.status = 'processing';
        job.attemptedAt = Date.now();

        try {
          // Execute handler
          const result = await handler(job.data, job.id);

          // Mark complete
          job.status = 'completed';
          job.result = result;

          await this.redis.hset(jobId, 'payload', JSON.stringify(job));
          await this.redis.hset(jobId, 'status', 'completed');
          await this.redis.zrem(queueKey, jobId);

          logger.info('Job completed', {
            jobId: job.id,
            jobType: job.type,
          });

          return { success: true, jobId, result };
        } catch (handlerError) {
          // Handle failure with retry logic
          job.retryCount++;
          job.error = handlerError.message;

          if (job.retryCount < job.maxRetries) {
            // Schedule retry with exponential backoff
            const delayMs = this.baseDelayMs * Math.pow(this.backoffMultiplier, job.retryCount - 1);
            const nextScheduledTime = now + delayMs;

            job.status = 'pending';
            await this.redis.hset(jobId, 'payload', JSON.stringify(job));
            await this.redis.zadd(queueKey, nextScheduledTime, jobId);

            logger.warn('Job scheduled for retry', {
              jobId: job.id,
              jobType: job.type,
              attemptNumber: job.retryCount,
              delayMs,
              error: handlerError.message,
            });

            return {
              success: false,
              jobId,
              retryScheduled: true,
              retryIn: delayMs,
              error: handlerError.message,
            };
          } else {
            // Max retries exceeded, move to dead letter queue
            job.status = 'failed';
            await this.redis.hset(jobId, 'payload', JSON.stringify(job));
            await this.redis.hset(jobId, 'status', 'failed');

            // Move to DLQ
            const dlqKey = `dlq:${jobType}`;
            await this.redis.lpush(dlqKey, jobId);
            await this.redis.zrem(queueKey, jobId);

            logger.error('Job failed permanently, moved to DLQ', {
              jobId: job.id,
              jobType: job.type,
              retryCount: job.retryCount,
              error: handlerError.message,
            });

            return {
              success: false,
              jobId,
              error: handlerError.message,
              movedToDLQ: true,
            };
          }
        }
      } finally {
        // Release lock
        await this.redis.del(lockKey);
      }
    } catch (error) {
      logger.error('Job processing error', {
        jobType,
        vendorId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    try {
      const payload = await this.redis.hget(jobId, 'payload');
      if (!payload) {
        return null;
      }

      return JSON.parse(payload);
    } catch (error) {
      logger.error('Failed to fetch job', { jobId, error: error.message });
      return null;
    }
  }

  /**
   * Get dead letter queue (failed jobs)
   * 
   * @param {string} jobType - Job type
   * @param {number} limit - Max items to return (default: 100)
   */
  async getDeadLetterQueue(jobType, limit = 100) {
    try {
      const dlqKey = `dlq:${jobType}`;
      const jobIds = await this.redis.lrange(dlqKey, 0, limit - 1);

      const jobs = await Promise.all(
        jobIds.map((jobId) => this.getJobStatus(jobId))
      );

      return jobs.filter((j) => j !== null);
    } catch (error) {
      logger.error('Failed to fetch DLQ', {
        jobType,
        error: error.message,
      });

      return [];
    }
  }

  /**
   * Retry a failed job from DLQ
   */
  async retryFailedJob(jobId) {
    try {
      const job = await this.getJobStatus(jobId);

      if (!job) {
        throw new Error('Job not found');
      }

      if (job.status !== 'failed') {
        throw new Error(`Job status is ${job.status}, not failed`);
      }

      // Reset and requeue
      job.status = 'pending';
      job.retryCount = 0;
      job.error = null;

      await this.redis.hset(jobId, 'payload', JSON.stringify(job));

      const queueKey = `queue:${job.type}:${job.vendorId}`;
      await this.redis.zadd(queueKey, Date.now(), jobId);

      // Remove from DLQ
      const dlqKey = `dlq:${job.type}`;
      await this.redis.lrem(dlqKey, 1, jobId);

      logger.info('Failed job requeued', {
        jobId,
        jobType: job.type,
      });

      return true;
    } catch (error) {
      logger.error('Failed to retry job', {
        jobId,
        error: error.message,
      });

      throw error;
    }
  }
}

module.exports = JobQueueService;
