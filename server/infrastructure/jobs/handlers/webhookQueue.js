/**
 * Webhook Processing Job Queue
 * Handles asynchronous webhook processing with retry logic
 */

const { logger } = require('../../../shared/utils/logger');
const { fireAndForgetWithErrorLog } = require('../../../shared/utils/asyncErrorHandler');

/**
 * Webhook Job Queue.
 * Processes provider webhook events with retry behavior.
 */
class WebhookJobQueue {
  constructor(queue, webhookHandlers) {
    this.queue = queue;
    this.webhookHandlers = webhookHandlers;
    this.setupProcessor();
  }

  /**
   * Setup job processor
   */
  setupProcessor() {
    this.queue.process(async (job) => {
      const { provider, event, data } = job.data;

      logger.info('Processing webhook job', {
        jobId: job.id,
        provider,
        event,
        attempt: job.attemptsMade + 1
      });

      try {
        const handler = this.webhookHandlers[provider];
        
        if (!handler) {
          throw new Error(`No handler found for provider: ${provider}`);
        }

        const result = await handler.handle(event, data);

        logger.info('Webhook processed successfully', {
          jobId: job.id,
          provider,
          event,
          result
        });

        return { success: true, provider, event, result };
      } catch (error) {
        logger.error('Webhook processing failed', {
          jobId: job.id,
          provider,
          event,
          error: error.message,
          attempts: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts
        });

        throw error; // Bull will retry
      }
    });
  }

  /**
   * Add webhook processing job to queue
   * @param {string} provider - Payment provider (stripe, paystack, etc)
   * @param {string} event - Webhook event type
   * @param {object} data - Webhook payload
   * @param {object} options - Job options
   */
  async addWebhookJob(provider, event, data, options = {}) {
    const jobData = {
      provider,
      event,
      data
    };

    const jobOptions = {
      jobId: `webhook:${provider}:${event}:${Date.now()}`,
      priority: 10, // Higher priority than email
      ...options
    };

    try {
      const job = await this.queue.add(jobData, jobOptions);
      
      logger.info('Webhook job queued', {
        jobId: job.id,
        provider,
        event
      });

      return job;
    } catch (error) {
      logger.error('Failed to queue webhook job', {
        provider,
        event,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      id: job.id,
      state,
      progress,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      provider: job.data.provider,
      event: job.data.event
    };
  }

  /**
   * Get queue stats
   */
  async getStats() {
    const counts = await this.queue.getJobCounts();
    const failedJobs = await this.queue.getFailed(0, 100);
    const activeJobs = await this.queue.getActive();
    const waitingJobs = await this.queue.getWaiting(0, 100);

    return {
      ...counts,
      failedJobsCount: failedJobs.length,
      activeJobsCount: activeJobs.length,
      waitingJobsCount: waitingJobs.length
    };
  }

  /**
   * Get failed webhooks for a specific provider
   */
  async getFailedWebhooks(provider) {
    const failedJobs = await this.queue.getFailed(0, -1);
    
    return failedJobs.filter(job => job.data.provider === provider);
  }

  /**
   * Retry failed webhook
   */
  async retryWebhook(jobId) {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await job.retry();
    logger.info('Webhook job retry scheduled', { jobId });

    return job;
  }

  /**
   * Report job failure with standardized error logging
   * @private
   * @param {object} job - Bull job object
   * @param {object} error - Error object
   */
  async reportJobFailure(job, error) {
    await fireAndForgetWithErrorLog(
      async () => {
        logger.error('Webhook processing job failure', {
          jobId: job.id,
          provider: job.data.provider,
          event: job.data.event,
          attempts: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts,
          error: error.message,
        });
      },
      {
        service: 'WebhookJobQueue',
        operation: 'reportJobFailure',
        context: { jobId: job.id, provider: job.data.provider, event: job.data.event },
        severity: 'error'
      }
    );
  }
}

module.exports = WebhookJobQueue;
