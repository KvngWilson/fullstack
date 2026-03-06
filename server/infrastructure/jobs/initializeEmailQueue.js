const Bull = require('bull');
const { logger } = require('../../shared/utils/logger');
const { sendEmailJob } = require('../email/email');

/**
 * Email Queue Initializer.
 * Configures Bull email queue processors and enqueue helpers.
 */
class EmailQueueInitializer {
  /**
   * Initialize email queue with processor
   * @param {Object} redisConfig - Redis configuration
   * @returns {Object} Queue instance
   */
  static initializeQueue(redisConfig = {}) {
    const emailQueue = new Bull('email', {
      redis: {
        host: redisConfig.host || process.env.REDIS_HOST || 'localhost',
        port: redisConfig.port || process.env.REDIS_PORT || 6379,
        db: redisConfig.db || process.env.REDIS_DB || 0,
        password: redisConfig.password || process.env.REDIS_PASSWORD || undefined,
      },
    });

    emailQueue.process(async (job) => {
      logger.info('Processing email job', {
        jobId: job.id,
        email: job.data.to,
        template: job.data.templateName,
        attempt: job.attemptsMade + 1,
      });

      try {
        const result = await sendEmailJob(job.data);

        if (!result.success) {
          throw new Error(result.error || 'Email send failed');
        }

        logger.info('Email sent successfully', {
          jobId: job.id,
          email: job.data.to,
          template: job.data.templateName,
        });

        return { success: true, email: job.data.to };
      } catch (error) {
        logger.error('Email job failed', {
          jobId: job.id,
          email: job.data.to,
          template: job.data.templateName,
          error: error.message,
          attempts: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts,
        });

        throw error;
      }
    });

    emailQueue.on('completed', (job) => {
      logger.debug('Email job completed', {
        jobId: job.id,
        email: job.data.to,
        processingTime: job.finishedOn - job.processedOn,
      });
    });

    emailQueue.on('failed', (job, error) => {
      logger.warn('Email job failed after retries', {
        jobId: job.id,
        email: job.data.to,
        template: job.data.templateName,
        error: error.message,
        attempts: job.attemptsMade,
      });
    });

    logger.info('Email queue initialized successfully');
    return emailQueue;
  }

  /**
   * Add email to queue
   * @param {Object} emailQueue - Bull queue instance
   * @param {string} to - Recipient email
   * @param {string} templateName - Template name (e.g., 'password_reset')
   * @param {Object} templateData - Data to render template
   * @param {Object} options - Queue job options
   */
  static async queueEmail(
    emailQueue,
    to,
    templateName,
    templateData = {},
    options = {}
  ) {
    const jobData = {
      to,
      templateName,
      templateData,
      ...options.overrides,
    };

    const jobOptions = {
      attempts: options.attempts || 3,
      backoff: {
        type: 'exponential',
        delay: options.backoffDelay || 2000,
      },
      removeOnComplete: {
        age: options.keepCompletedAge || 3600,
      },
      removeOnFail: {
        age: options.keepFailedAge || 86400,
      },
      timeout: options.timeout || 30000,
      ...options.jobOptions,
    };

    try {
      const job = await emailQueue.add(jobData, jobOptions);

      logger.info('Email queued', {
        jobId: job.id,
        email: to,
        template: templateName,
      });

      return job;
    } catch (error) {
      logger.error('Failed to queue email', {
        email: to,
        template: templateName,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Get queue stats
   */
  static async getQueueStats(emailQueue) {
    const counts = await emailQueue.getJobCounts();
    return {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
      paused: counts.paused,
    };
  }
}

module.exports = EmailQueueInitializer;
