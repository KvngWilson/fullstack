const { getScheduler } = require('./JobScheduler');
const { refreshExchangeRates } = require('./exchangeRateRefreshJob');
const { logger } = require('../../shared/utils/logger');

/**
 * Initialize all background jobs
 */
async function initializeJobs() {
  try {
    logger.info('Initializing background jobs');

    const scheduler = getScheduler();

    scheduler.register(
      'exchange-rate-refresh',
      async () => {
        await refreshExchangeRates({
          provider: process.env.EXCHANGE_RATE_PROVIDER || 'MOCK',
        });
      },
      {
        intervalMinutes: 60,
        runImmediately: true,
        onError: async (error) => {
          logger.error('Exchange rate refresh job error', {
            error: error.message,
            stack: error.stack,
          });
        },
      }
    );

    await scheduler.start();

    logger.info('Background jobs initialized successfully');

    return scheduler;
  } catch (error) {
    logger.error('Failed to initialize background jobs', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Stop all background jobs
 */
function stopJobs() {
  try {
    const scheduler = getScheduler();
    scheduler.stop();
    logger.info('Background jobs stopped');
  } catch (error) {
    logger.error('Failed to stop background jobs', {
      error: error.message,
    });
  }
}

module.exports = {
  initializeJobs,
  stopJobs,
};
