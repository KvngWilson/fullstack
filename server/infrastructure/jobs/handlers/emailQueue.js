/**
 * Email Job Queue
 * Handles asynchronous email sending with retry logic
 */

const { logger } = require('../../../shared/utils/logger');

/**
 * Email Job Queue.
 * Processes queued email deliveries with retries.
 */
class EmailJobQueue {
  constructor(queue, emailService) {
    this.queue = queue;
    this.emailService = emailService;
    this.setupProcessor();
  }

  /**
   * Setup job processor
   */
  setupProcessor() {
    this.queue.process(async (job) => {
      const { email, template, data, subject } = job.data;

      logger.info('Processing email job', {
        jobId: job.id,
        email,
        template,
        attempt: job.attemptsMade + 1
      });

      try {
        await this.emailService.send({
          to: email,
          subject: subject || this.getSubject(template),
          template,
          data
        });

        logger.info('Email sent successfully', {
          jobId: job.id,
          email,
          template
        });

        return { success: true, email, template };
      } catch (error) {
        logger.error('Email send failed', {
          jobId: job.id,
          email,
          template,
          error: error.message,
          attempts: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts
        });

        throw error; // Bull will retry based on backoff
      }
    });
  }

  /**
   * Add email job to queue
   * @param {string} email - Recipient email
   * @param {string} template - Email template name
   * @param {object} data - Template data
   * @param {object} options - Job options
   */
  async addEmailJob(email, template, data, options = {}) {
    const jobData = {
      email,
      template,
      data,
      subject: options.subject
    };

    const jobOptions = {
      jobId: `email:${email}:${template}:${Date.now()}`,
      ...options
    };

    try {
      const job = await this.queue.add(jobData, jobOptions);
      
      logger.info('Email job queued', {
        jobId: job.id,
        email,
        template
      });

      return job;
    } catch (error) {
      logger.error('Failed to queue email job', {
        email,
        template,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get email subject based on template
   * @private
   */
  getSubject(template) {
    const subjects = {
      order_confirmation: 'Order Confirmation',
      order_shipped: 'Your Order Has Shipped',
      order_delivered: 'Your Order Has Been Delivered',
      payment_receipt: 'Payment Receipt',
      password_reset: 'Reset Your Password',
      email_verification: 'Verify Your Email',
      invite_user: 'You\'ve Been Invited',
      refund_processed: 'Refund Processed',
      account_suspended: 'Account Suspended'
    };

    return subjects[template] || 'Notification';
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
      stacktrace: job.stacktrace
    };
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId) {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await job.retry();
    logger.info('Email job retry scheduled', { jobId });

    return job;
  }

  /**
   * Remove job
   */
  async removeJob(jobId) {
    const job = await this.queue.getJob(jobId);
    
    if (job) {
      await job.remove();
      logger.info('Email job removed', { jobId });
    }
  }

  /**
   * Get queue stats
   */
  async getStats() {
    const counts = await this.queue.getJobCounts();
    const failedJobs = await this.queue.getFailed(0, 100);
    const activeJobs = await this.queue.getActive();

    return {
      ...counts,
      failedJobsCount: failedJobs.length,
      activeJobsCount: activeJobs.length
    };
  }

  /**
   * Clear failed jobs older than specified duration
   * @param {number} duration - Duration in milliseconds
   */
  async clearOldFailedJobs(duration = 7 * 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - duration;
    const failedJobs = await this.queue.getFailed(0, -1);

    let removed = 0;

    for (const job of failedJobs) {
      if (job.finishedOn < cutoff) {
        await job.remove();
        removed++;
      }
    }

    logger.info('Old failed email jobs cleared', { count: removed });
    return removed;
  }
}

module.exports = EmailJobQueue;
