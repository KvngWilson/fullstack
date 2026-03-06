/**
 * Simple Job Scheduler
 * Manages periodic background jobs using setInterval
 * Alternative to Bull/node-cron for lightweight scheduling
 */

const { logger } = require('../../shared/utils/logger');

class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.intervals = new Map();
  }

  /**
   * Register a job to run on a schedule
   * @param {string} name - Job name
   * @param {Function} handler - Job handler function
   * @param {Object} options - Schedule options
   * @param {number} options.intervalMinutes - Interval in minutes
   * @param {boolean} options.runImmediately - Run immediately on start (default: false)
   * @param {Function} options.onError - Error handler
   */
  register(name, handler, options = {}) {
    const { intervalMinutes = 60, runImmediately = false, onError } = options;

    if (this.jobs.has(name)) {
      logger.warn('Job already registered, skipping', { name });
      return;
    }

    this.jobs.set(name, {
      name,
      handler,
      intervalMinutes,
      runImmediately,
      onError,
      lastRun: null,
      nextRun: null,
      running: false,
    });

    logger.info('Job registered', {
      name,
      intervalMinutes,
      runImmediately,
    });
  }

  /**
   * Start all registered jobs
   */
  async start() {
    logger.info('Starting job scheduler', {
      jobCount: this.jobs.size,
    });

    for (const [name, job] of this.jobs) {
      try {
        // Run immediately if configured
        if (job.runImmediately) {
          logger.info('Running job immediately', { name });
          await this._executeJob(job);
        }

        // Schedule recurring execution
        const intervalMs = job.intervalMinutes * 60 * 1000;
        const interval = setInterval(async () => {
          await this._executeJob(job);
        }, intervalMs);

        this.intervals.set(name, interval);

        // Calculate next run time
        job.nextRun = new Date(Date.now() + intervalMs);

        logger.info('Job scheduled', {
          name,
          intervalMinutes: job.intervalMinutes,
          nextRun: job.nextRun.toISOString(),
        });
      } catch (error) {
        logger.error('Failed to start job', {
          name,
          error: error.message,
        });
      }
    }
  }

  /**
   * Execute a job
   * @private
   */
  async _executeJob(job) {
    if (job.running) {
      logger.warn('Job already running, skipping', { name: job.name });
      return;
    }

    const startTime = Date.now();
    job.running = true;

    try {
      logger.info('Executing job', { name: job.name });

      await job.handler();

      const duration = Date.now() - startTime;
      job.lastRun = new Date();

      logger.info('Job completed successfully', {
        name: job.name,
        duration: `${duration}ms`,
        lastRun: job.lastRun.toISOString(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Job execution failed', {
        name: job.name,
        error: error.message,
        duration: `${duration}ms`,
      });

      // Call custom error handler if provided
      if (job.onError) {
        try {
          await job.onError(error);
        } catch (handlerError) {
          logger.error('Job error handler failed', {
            name: job.name,
            error: handlerError.message,
          });
        }
      }
    } finally {
      job.running = false;
    }
  }

  /**
   * Manually trigger a job
   * @param {string} name - Job name
   */
  async triggerJob(name) {
    const job = this.jobs.get(name);

    if (!job) {
      throw new Error(`Job not found: ${name}`);
    }

    logger.info('Manually triggering job', { name });
    await this._executeJob(job);
  }

  /**
   * Stop all jobs
   */
  stop() {
    logger.info('Stopping job scheduler');

    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      logger.info('Job stopped', { name });
    }

    this.intervals.clear();
  }

  /**
   * Get job status
   * @param {string} name - Job name (optional)
   * @returns {Object|Array} Job status or array of all job statuses
   */
  getStatus(name = null) {
    if (name) {
      const job = this.jobs.get(name);
      if (!job) {
        return null;
      }

      return {
        name: job.name,
        intervalMinutes: job.intervalMinutes,
        lastRun: job.lastRun?.toISOString() || null,
        nextRun: job.nextRun?.toISOString() || null,
        running: job.running,
      };
    }

    // Return all job statuses
    return Array.from(this.jobs.values()).map((job) => ({
      name: job.name,
      intervalMinutes: job.intervalMinutes,
      lastRun: job.lastRun?.toISOString() || null,
      nextRun: job.nextRun?.toISOString() || null,
      running: job.running,
    }));
  }
}

// Singleton instance
let schedulerInstance = null;

/**
 * Get the scheduler singleton instance
 */
function getScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new JobScheduler();
  }
  return schedulerInstance;
}

module.exports = {
  JobScheduler,
  getScheduler,
};
