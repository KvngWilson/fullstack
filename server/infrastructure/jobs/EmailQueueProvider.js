const { getJobQueuesRuntime } = require('./runtime');
const { sendEmailJob } = require('../email/email');
const logger = require('../../shared/utils/logger');

/**
 * Email Queue Provider
 * Centralized access to the email Bull queue.
 *
 * queueEmail() is the preferred way to send emails across domain services.
 * It enqueues the job for async delivery with retry/backoff.
 * Falls back to synchronous sendEmailJob() when the queue is unavailable,
 * so emails still go out in development without a running worker.
 */
class EmailQueueProvider {
  static getEmailQueue() {
    const runtime = getJobQueuesRuntime();
    if (!runtime?.emailJobQueue?.queue) {
      throw new Error(
        'Email queue not initialized. Ensure Bull queue is started in setup.js and getJobQueuesRuntime() is called.'
      );
    }
    return runtime.emailJobQueue.queue;
  }

  static hasEmailQueue() {
    const runtime = getJobQueuesRuntime();
    return !!runtime?.emailJobQueue?.queue;
  }

  /**
   * Queue an email for async delivery.
   * Falls back to synchronous send when queue is unavailable.
   *
   * @param {string} to          - Recipient address
   * @param {string} template    - Template name (e.g. 'orderConfirmation')
   * @param {object} data        - Template variables
   * @param {object} [options]   - Additional job options (subject, delay, etc.)
   */
  static async queueEmail(to, template, data, options = {}) {
    const runtime = getJobQueuesRuntime();
    if (runtime?.emailJobQueue) {
      try {
        await runtime.emailJobQueue.addEmailJob(to, template, data, options);
        return;
      } catch (err) {
        logger.warn('EmailQueueProvider: failed to enqueue email; falling back to sync send', {
          error: err.message, to, template,
        });
      }
    }
    // Fallback: send synchronously (dev / queue-down scenario)
    await sendEmailJob({
      to,
      templateName: template,
      templateData: data,
      overrideSubject: options.subject,
    });
  }
}

module.exports = EmailQueueProvider;
