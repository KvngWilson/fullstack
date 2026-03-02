/**
 * Job Queue Initialization
 * Sets up and initializes all job queues
 */

const JobQueueManager = require('./JobQueueManager');
const EmailJobQueue = require('./handlers/emailQueue');
const WebhookJobQueue = require('./handlers/webhookQueue');
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

    // Create email queue
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

    // Create webhook queue
    const webhookQueue = queueManager.createQueue('webhooks', {
      defaultJobOptions: {
        attempts: 5, // Webhooks need more retries
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        timeout: 60000
      }
    });

    const webhookJobQueue = new WebhookJobQueue(webhookQueue, webhookHandlers);

    // Create reporting queue (lower priority)
    const reportingQueue = queueManager.createQueue('reporting', {
      defaultJobOptions: {
        attempts: 2,
        timeout: 120000
      }
    });

    // Create cleanup queue (for background maintenance)
    const cleanupQueue = queueManager.createQueue('cleanup', {
      defaultJobOptions: {
        attempts: 1,
        timeout: 3600000 // 1 hour
      }
    });

    logger.info('All job queues initialized successfully');

    return {
      queueManager,
      emailJobQueue,
      webhookJobQueue,
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
