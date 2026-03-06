/**
 * Job Management Controller
 * Provides endpoints for job status and manual triggering
 * Restricted to ADMIN and root users only
 */

const { getScheduler } = require('../../../infrastructure/jobs/JobScheduler');
const { refreshExchangeRates } = require('../../../infrastructure/jobs/exchangeRateRefreshJob');
const { logger } = require('../../../shared/utils/logger');
const { asyncHandler, BadRequestError } = require('../../../shared/utils/errors');

/**
 * Get status of all background jobs
 * GET /api/v1/admin/jobs/status
 */
const getJobStatus = asyncHandler(async (req, res) => {
  const user = req.user;

  const scheduler = getScheduler();
  const jobs = scheduler.getStatus();

  logger.info('Job status requested', {
    userId: user.id,
  });

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

  const scheduler = getScheduler();
  const job = scheduler.getStatus(jobName);

  if (!job) {
    throw new BadRequestError(`Job not found: ${jobName}`);
  }

  res.json({
    success: true,
    data: job,
  });
});

/**
 * Manually trigger a job
 * POST /api/v1/admin/jobs/:jobName/trigger
 */
const triggerJob = asyncHandler(async (req, res) => {
  const { jobName } = req.params;

  const user = req.user;

  logger.info('Manual job trigger requested', {
    jobName,
    userId: user.id,
  });

  const scheduler = getScheduler();

  try {
    await scheduler.triggerJob(jobName);

    res.json({
      success: true,
      message: `Job ${jobName} triggered successfully`,
    });
  } catch (error) {
    logger.error('Failed to trigger job', {
      jobName,
      error: error.message,
      userId: user.id,
    });

    throw new BadRequestError(`Failed to trigger job: ${error.message}`);
  }
});

/**
 * Manually refresh exchange rates (convenience endpoint)
 * POST /api/v1/admin/jobs/exchange-rates/refresh
 */
const refreshExchangeRatesManually = asyncHandler(async (req, res) => {
  const user = req.user;

  const { provider } = req.body;

  logger.info('Manual exchange rate refresh requested', {
    provider: provider || 'default',
    userId: user.id,
  });

  try {
    const result = await refreshExchangeRates({
      provider: provider || process.env.EXCHANGE_RATE_PROVIDER || 'MOCK',
    });

    res.json({
      success: true,
      message: 'Exchange rates refreshed successfully',
      data: {
        provider: result.provider,
        inserted: result.inserted,
        updated: result.updated,
        failed: result.failed,
        status: result.status,
        duration: `${result.duration}ms`,
        pairs: result.pairs.map(p => ({
          from: p.from,
          to: p.to,
          rate: p.rate,
          action: p.action,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to refresh exchange rates', {
      error: error.message,
      userId: user.id,
    });

    throw new BadRequestError(`Failed to refresh exchange rates: ${error.message}`);
  }
});

module.exports = {
  getJobStatus,
  getSpecificJobStatus,
  triggerJob,
  refreshExchangeRatesManually,
};
