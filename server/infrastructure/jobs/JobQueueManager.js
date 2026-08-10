const Queue = require('bull');
const { logger } = require('../../shared/utils/logger');

/**
 * Job Queue Manager.
 * Creates and manages Bull queues for asynchronous jobs.
 */
class JobQueueManager {
  constructor(redisConfig) {
    this.redisConfig = redisConfig;
    this.queues = new Map();
  }

  /**
   * Create or get a job queue
   * @param {string} queueName - Name of the queue
   * @param {object} options - Queue options
   * @returns {Queue} - Bull queue instance
   */
  createQueue(queueName, options = {}) {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName);
    }

    const defaultOptions = {
      redis: {
        host: this.redisConfig.host || 'localhost',
        port: this.redisConfig.port || 6379,
        password: this.redisConfig.password
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        timeout: 30000
      },
      settings: {
        stalledInterval: 5000,
        maxStalledCount: 2,
        lockDuration: 30000,
        lockRenewTime: 15000
      }
    };

    const queueOptions = {
      ...defaultOptions,
      ...options,
      redis: { ...defaultOptions.redis, ...options.redis },
      defaultJobOptions: {
        ...defaultOptions.defaultJobOptions,
        ...options.defaultJobOptions
      }
    };

    const queue = new Queue(queueName, queueOptions);

    queue.on('error', (error) => {
      logger.error(`Queue error [${queueName}]`, {
        error: error.message,
        queue: queueName
      });
    });

    queue.on('failed', (job, error) => {
      logger.warn(`Job failed [${queueName}]`, {
        jobId: job.id,
        jobData: job.data,
        error: error.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        queue: queueName
      });
    });

    queue.on('stalled', (job) => {
      logger.warn(`Job stalled [${queueName}]`, {
        jobId: job.id,
        queue: queueName
      });
    });

    queue.on('completed', (job) => {
      logger.debug(`Job completed [${queueName}]`, {
        jobId: job.id,
        queue: queueName
      });
    });

    this.queues.set(queueName, queue);
    logger.info(`Job queue created [${queueName}]`);

    return queue;
  }

  /**
   * Get existing queue
   * @param {string} queueName - Name of the queue
   * @returns {Queue|null} - Queue or null if not found
   */
  getQueue(queueName) {
    return this.queues.get(queueName) || null;
  }

  /**
   * Close all queues
   */
  async closeAll() {
    logger.info('Closing all job queues');
    
    const promises = Array.from(this.queues.values()).map(queue =>
      queue.close().catch(err =>
        logger.error('Error closing queue', { error: err.message })
      )
    );

    await Promise.all(promises);
    this.queues.clear();
    
    logger.info('All job queues closed');
  }

  /**
   * Get all queue stats
   */
  async getStats() {
    const stats = {};
    
    for (const [name, queue] of this.queues) {
      const counts = await queue.getJobCounts();
      stats[name] = {
        ...counts,
        isPaused: queue.isPaused(),
        isGlobal: queue.isGlobal()
      };
    }

    return stats;
  }
}

module.exports = JobQueueManager;
