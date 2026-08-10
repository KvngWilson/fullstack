const { logger } = require('../../../shared/utils/logger');

/**
 * Initialize all background jobs
 * 
 * IMPORTANT: As of Option 3 (Bull consolidation):
 * - All background jobs are now processed by a separate Bull-based worker service
 * - The API server does NOT process jobs; it only enqueues them via Bull queues
 * - The worker service (src/worker.js) handles all job processing
 * - Exchange rate refresh and other jobs run as Bull repeatable jobs registered in initializeQueues
 */
async function initializeJobs() {
  try {
    logger.info('Background jobs configuration loaded');
    logger.info('Jobs are processed by dedicated Bull worker service (docker service: worker)');
    logger.info('See infrastructure/jobs/initializeQueues.js for job registration details');

    return null;
  } catch (error) {
    logger.error('Failed to initialize background jobs configuration', {
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  initializeJobs,
};
