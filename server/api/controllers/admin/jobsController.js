/**
 * Job Management Controller
 * Provides endpoints for job status and manual triggering
 * Restricted to ADMIN and root users only
 */

const { getJobQueuesRuntime } = require('../../../infrastructure/jobs/runtime');
const { logger } = require('../../../shared/utils/logger');
const { asyncHandler, BadRequestError } = require('../../../shared/utils/errors');

/**
 * Get status of all background jobs
 * GET /api/v1/admin/jobs/status
 */
const getJobStatus = asyncHandler(async (req, res) => {
  const user = req.user;

  const runtime = getJobQueuesRuntime();

  if (!runtime) {
    logger.warn('Job status requested but job queues not initialized', { userId: user?.id });
    return res.status(503).json({ success: false, message: 'Job queues not initialized' });
  }

  const jobs = [];

  // Prefer per-handler stats when available
  if (runtime.exchangeRateJobQueue && typeof runtime.exchangeRateJobQueue.getStats === 'function') {
    jobs.push({ name: 'exchange-rate-refresh', stats: await runtime.exchangeRateJobQueue.getStats() });
  }

  if (runtime.emailJobQueue && typeof runtime.emailJobQueue.getStats === 'function') {
    jobs.push({ name: 'email', stats: await runtime.emailJobQueue.getStats() });
  }

  if (runtime.webhookJobQueue && typeof runtime.webhookJobQueue.getStats === 'function') {
    jobs.push({ name: 'webhooks', stats: await runtime.webhookJobQueue.getStats() });
  }

  // Fall back to queueManager wide stats
  if (runtime.queueManager && typeof runtime.queueManager.getStats === 'function') {
    try {
      const mgrStats = await runtime.queueManager.getStats();
      jobs.push({ name: 'queueManager', stats: mgrStats });
    } catch (err) {
      logger.warn('Failed to obtain queueManager stats', { error: err.message });
    }
  }

  logger.info('Job status requested', { userId: user?.id });

  res.json({
    success: true,
    data: {
      jobs,
      count: jobs.length,
    },
  });
});

/**
 * Get status of specific job
 * GET /api/v1/admin/jobs/:jobName/status
 */
const getSpecificJobStatus = asyncHandler(async (req, res) => {
  const { jobName } = req.params;

  const runtime = getJobQueuesRuntime();

  if (!runtime) {
    throw new BadRequestError('Job queues not initialized');
  }

  // exchange-rate-refresh
  if (jobName === 'exchange-rate-refresh' && runtime.exchangeRateJobQueue) {
    const stats = await runtime.exchangeRateJobQueue.getStats();
    return res.json({ success: true, data: stats });
  }

  // known queue handlers
  if (jobName === 'email' && runtime.emailJobQueue) {
    const stats = await runtime.emailJobQueue.getStats();
    return res.json({ success: true, data: stats });
  }

  if (jobName === 'webhooks' && runtime.webhookJobQueue) {
    const stats = await runtime.webhookJobQueue.getStats();
    return res.json({ success: true, data: stats });
  }

  // Fallback: try queueManager.getQueue(jobName)
  if (runtime.queueManager && typeof runtime.queueManager.getQueue === 'function') {
    const q = runtime.queueManager.getQueue(jobName);
    if (q) {
      const counts = await q.getJobCounts();
      return res.json({ success: true, data: { name: jobName, counts } });
    }
  }

  throw new BadRequestError(`Job not found: ${jobName}`);
});

async function enqueueManualJob(jobName, payload = {}, user = null) {
  const runtime = getJobQueuesRuntime();

  if (!runtime) {
    throw new BadRequestError('Job queues not initialized');
  }

  try {
    // Special-case exchange-rate-refresh
    if (jobName === 'exchange-rate-refresh' && runtime.exchangeRateJobQueue) {
      const job = await runtime.exchangeRateJobQueue.queue.add(
        { provider: payload.provider || process.env.EXCHANGE_RATE_PROVIDER || 'MOCK' },
        { jobId: `exchange-rate-refresh:manual:${Date.now()}` },
      );

      return job;
    }

    // Generic queue trigger: attempt to find a queue by name
    if (runtime.queueManager && typeof runtime.queueManager.getQueue === 'function') {
      const queue = runtime.queueManager.getQueue(jobName);
      if (queue) {
        const job = await queue.add(payload, { jobId: `${jobName}:manual:${Date.now()}` });
        return job;
      }
    }

    throw new BadRequestError(`No queue found for job: ${jobName}`);
  } catch (error) {
    logger.error('Failed to trigger job', { jobName, error: error.message, userId: user?.id });
    throw new BadRequestError(`Failed to trigger job: ${error.message}`);
  }
}

/**
 * Manually trigger a job
 * POST /api/v1/admin/jobs/:jobName/trigger
 */
const triggerJob = asyncHandler(async (req, res) => {
  const { jobName } = req.params;
  const user = req.user;
  const payload = req.body || {};

  logger.info('Manual job trigger requested', { jobName, userId: user?.id });

  const job = await enqueueManualJob(jobName, payload, user);
  return res.json({ success: true, message: `Job ${jobName} queued`, jobId: job.id });
});

/**
 * Manually refresh exchange rates (convenience endpoint)
 * POST /api/v1/admin/jobs/exchange-rates/refresh
 */
const refreshExchangeRatesManually = asyncHandler(async (req, res) => {
  const user = req.user;
  const { provider } = req.body || {};

  logger.info('Manual exchange rate refresh requested', {
    provider: provider || 'default',
    userId: user?.id,
  });

  const runtime = getJobQueuesRuntime();
  if (!runtime || !runtime.exchangeRateJobQueue) {
    throw new BadRequestError('Exchange rate queue not available');
  }

  try {
    const job = await runtime.exchangeRateJobQueue.queue.add(
      { provider: provider || process.env.EXCHANGE_RATE_PROVIDER || 'MOCK' },
      { jobId: `exchange-rate-refresh:manual:${Date.now()}` },
    );

    res.json({ success: true, message: 'Exchange rate refresh enqueued', jobId: job.id });
  } catch (error) {
    logger.error('Failed to enqueue exchange rate refresh', { error: error.message, userId: user?.id });
    throw new BadRequestError(`Failed to enqueue exchange rates refresh: ${error.message}`);
  }
});

module.exports = {
  enqueueManualJob,
  getJobStatus,
  getSpecificJobStatus,
  triggerJob,
  refreshExchangeRatesManually,
};