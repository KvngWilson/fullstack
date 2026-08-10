const JobQueueManager = require('./JobQueueManager');
const EmailJobQueue = require('./handlers/emailQueue');
const WebhookJobQueue = require('./handlers/webhookQueue');
const { ExchangeRateQueue } = require('./queues/exchangeRateQueue');
const { logger } = require('../../shared/utils/logger');

/**
 * Initialize all job queues
 */
async function initializeJobQueues(emailService, webhookHandlers = {}) {
  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD
    };

    const queueManager = new JobQueueManager(redisConfig);

    const emailQueue = queueManager.createQueue('email', {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        timeout: 30000
      }
    });

    const emailJobQueue = new EmailJobQueue(emailQueue, emailService);

    const webhookQueue = queueManager.createQueue('webhooks', {
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        timeout: 60000
      }
    });

    const webhookJobQueue = new WebhookJobQueue(webhookQueue, webhookHandlers);

    // Reporting queue – processor logs job details; wire up real handlers when ready
    const reportingQueue = queueManager.createQueue('reporting', {
      defaultJobOptions: {
        attempts: 2,
        timeout: 120000
      }
    });
    reportingQueue.process(async (job) => {
      logger.info('Processing reporting job', { jobId: job.id, type: job.data.type });
      // TODO: dispatch to a real reporting handler based on job.data.type
      logger.warn('Reporting job received but no handler is registered', {
        jobId: job.id,
        type: job.data.type,
      });
      return { skipped: true, reason: 'no_handler' };
    });

    // Cleanup queue – processor logs job details; wire up real handlers when ready
    const cleanupQueue = queueManager.createQueue('cleanup', {
      defaultJobOptions: {
        attempts: 1,
        timeout: 3600000
      }
    });
    cleanupQueue.process(async (job) => {
      logger.info('Processing cleanup job', { jobId: job.id, type: job.data.type });
      // TODO: dispatch to a real cleanup handler based on job.data.type
      logger.warn('Cleanup job received but no handler is registered', {
        jobId: job.id,
        type: job.data.type,
      });
      return { skipped: true, reason: 'no_handler' };
    });

    const exchangeRateQueue = queueManager.createQueue('exchange-rates', {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        timeout: 120000
      }
    });

    const exchangeRateJobQueue = new ExchangeRateQueue(exchangeRateQueue);

    // Register repeatable exchange rate refresh job
    // Check if migrations are ready before registering
    const { pool } = require('../../config/db');
    try {
      const dbReadyRes = await pool.query(
        "SELECT to_regclass('public.exchange_rates') AS exists"
      );
      if (dbReadyRes.rows[0].exists) {
        await exchangeRateJobQueue.registerRepeatable({
          intervalMinutes: 60,
          runImmediate: process.env.ALLOW_IMMEDIATE_JOBS !== 'false',
        });
      } else {
        logger.warn('Exchange rates table not ready; repeatable job not registered');
      }
    } catch (err) {
      logger.warn('Failed to register repeatable exchange rate job', { error: err.message });
    }

    logger.info('All job queues initialized successfully');

    return {
      queueManager,
      emailJobQueue,
      webhookJobQueue,
      exchangeRateJobQueue,
      reportingQueue,
      cleanupQueue
    };
  } catch (error) {
    logger.error('Failed to initialize job queues', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Gracefully shutdown all job queues
 */
async function shutdownJobQueues(queueManager) {
  try {
    logger.info('Shutting down job queues');
    await queueManager.closeAll();
    logger.info('Job queues shutdown complete');
  } catch (error) {
    logger.error('Error during job queue shutdown', {
      error: error.message
    });
  }
}

module.exports = {
  initializeJobQueues,
  shutdownJobQueues
};
