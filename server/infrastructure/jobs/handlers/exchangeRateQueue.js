/**
 * Exchange Rate Queue Handler
 * Processes repeatable exchange rate refresh jobs via Bull
 */

const { logger } = require('../../../shared/utils/logger');
const { refreshExchangeRates } = require('../tasks/exchangeRateRefreshJob');
const { fireAndForgetWithErrorLog } = require('../../../shared/utils/asyncErrorHandler');

/**
 * Exchange Rate Queue Handler.
 * Processes queued exchange rate refresh tasks.
 */
class ExchangeRateQueue {
  constructor(queue) {
    this.queue = queue;
    this.setupProcessor();
  }

  /**
   * Setup job processor
   */
  setupProcessor() {
    this.queue.process(async (job) => {
      const { provider = process.env.EXCHANGE_RATE_PROVIDER || 'MOCK' } = job.data;

      logger.info('Processing exchange rate refresh job', {
        jobId: job.id,
        provider,
        attempt: job.attemptsMade + 1,
      });

      try {
        const result = await refreshExchangeRates({ provider });

        logger.info('Exchange rate refresh completed', {
          jobId: job.id,
          provider,
          inserted: result.inserted,
          updated: result.updated,
          failed: result.failed,
          status: result.status,
        });

        return result;
      } catch (error) {
        logger.error('Exchange rate refresh failed', {
          jobId: job.id,
          provider,
          error: error.message,
          attempts: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts,
        });

        throw error; // Bull will retry based on backoff
      }
    });
  }

  /**
   * Register repeatable exchange rate job
   * Runs at specified interval (default: every hour)
   */
  async registerRepeatable(options = {}) {
    const { intervalMinutes = 60, runImmediate = false } = options;

    try {
      // Remove any existing repeatable job to avoid duplicates
      const repeatableJobs = await this.queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === 'exchange-rate-refresh') {
          await this.queue.removeRepeatableByKey(job.key);
          logger.info('Removed existing exchange-rate-refresh repeatable job');
        }
      }

      // Add repeatable job
      const jobData = {
        provider: process.env.EXCHANGE_RATE_PROVIDER || 'MOCK',
      };

      const repeatOptions = {
        repeat: {
          every: intervalMinutes * 60 * 1000, // Convert to milliseconds
        },
        jobId: 'exchange-rate-refresh',
      };

      const job = await this.queue.add(jobData, repeatOptions);

      logger.info('Exchange rate refresh repeatable job registered', {
        jobId: job.id,
        intervalMinutes,
        nextRun: new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString(),
      });

      // Optionally run immediately
      if (runImmediate) {
        try {
          const immediateJob = await this.queue.add(jobData, {
            jobId: `exchange-rate-refresh:immediate:${Date.now()}`,
            priority: 10,
          });

          logger.info('Exchange rate refresh immediate job queued', {
            jobId: immediateJob.id,
          });
        } catch (err) {
          logger.warn('Failed to queue immediate exchange rate refresh', {
            error: err.message,
          });
        }
      }

      return job;
    } catch (error) {
      logger.error('Failed to register exchange rate refresh job', {
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Get queue stats
   */
  async getStats() {
    const counts = await this.queue.getJobCounts();
    const failedJobs = await this.queue.getFailed(0, 100);
    const activeJobs = await this.queue.getActive();
    const repeatableJobs = await this.queue.getRepeatableJobs();

    return {
      ...counts,
      failedJobsCount: failedJobs.length,
      activeJobsCount: activeJobs.length,
      repeatableJobsCount: repeatableJobs.length,
    };
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
    logger.info('Exchange rate job retry scheduled', { jobId });

    return job;
  }

  /**
   * Remove job
   */
  async removeJob(jobId) {
    const job = await this.queue.getJob(jobId);

    if (job) {
      await job.remove();
      logger.info('Exchange rate job removed', { jobId });
    }
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
        logger.error('Exchange rate refresh job failure', {
          jobId: job.id,
          provider: job.data.provider,
          attempts: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts,
          error: error.message,
        });
      },
      {
        service: 'ExchangeRateQueue',
        operation: 'reportJobFailure',
        context: { jobId: job.id, provider: job.data.provider },
        severity: 'error'
      }
    );
  }
}

module.exports = ExchangeRateQueue;
