/**
 * Worker Process Entry Point
 * Dedicated process for Bull queue job processing
 * Separate from the web API server; runs only job processors
 */

require("dotenv").config();

const { logger } = require("../shared/utils/logger");
const { sendEmailJob } = require("../infrastructure/email/email");
const RabbitMQEventBus = require("../infrastructure/messaging/rabbitMqEventBus");
const {
  initializeJobQueues,
} = require("../infrastructure/jobs/initializeQueues");
const {
  setJobQueuesRuntime,
  clearJobQueuesRuntime,
} = require("../infrastructure/jobs/runtime");
const dispatcher = require("../domain/shared/events/dispatcher");
const {
  createWebhookHandlers,
} = require("../infrastructure/jobs/handlers/webhookHandlers");

let isShuttingDown = false;
let _rabbitMQBus = null;

// Mirror the email adapter from setup.js so the worker can process email jobs
function createEmailServiceAdapter() {
  return {
    async send({ to, subject, template, data }) {
      const result = await sendEmailJob({
        to,
        templateName: template,
        templateData: data,
        overrideSubject: subject,
      });

      if (!result?.success) {
        const message =
          result?.error?.message || result?.error || "Email send failed";
        throw new Error(message);
      }

      return result;
    },
  };
}

async function initRabbitMQ() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    logger.info("RABBITMQ_URL not set; using in-memory EventBus");
    return;
  }
  try {
    const bus = new RabbitMQEventBus({ url });
    await bus.connect();
    dispatcher.init(bus);
    _rabbitMQBus = bus;
    logger.info("RabbitMQ EventBus active (worker)");
  } catch (err) {
    logger.warn(
      "RabbitMQ unavailable in worker; falling back to in-memory EventBus",
      {
        error: err.message,
      },
    );
  }
}

/**
 * Start the worker process
 */
async function startWorker() {
  try {
    logger.info("Worker process starting...");

    // Load configuration (must be after dotenv)
    require("../config/env");

    // Initialize database connection
    const { pool } = require("../config/db");

    // Test database connection
    try {
      const res = await pool.query("SELECT NOW()");
      logger.info("Database connection established", {
        timestamp: res.rows[0].now,
      });
    } catch (err) {
      logger.error("Failed to connect to database", { error: err.message });
      throw err;
    }

    // Connect RabbitMQ before initialising job queues so event publishing works
    await initRabbitMQ();

    // Initialize Bull queues (Bull manages its own Redis connections)
    logger.info("Initializing Bull queues...");

    const queues = await initializeJobQueues(
      createEmailServiceAdapter(),
      createWebhookHandlers(),
    );
    setJobQueuesRuntime(queues);

    const {
      emailJobQueue,
      webhookJobQueue,
      exchangeRateJobQueue,
      queueManager,
    } = queues;

    const queueNames = Object.keys(queues).filter(
      (key) => key !== "queueManager",
    );
    logger.info("Bull queues initialized successfully", { queues: queueNames });

    // Purge stale failed jobs once daily (keep failures < 7 days old)
    const FAILED_JOB_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    const cleanupFailedJobs = async () => {
      try {
        await emailJobQueue.clearOldFailedJobs(FAILED_JOB_MAX_AGE_MS);
      } catch (err) {
        logger.warn("Failed to clear old email failed jobs", {
          error: err.message,
        });
      }
    };
    // Run once on startup then every 24 h
    cleanupFailedJobs();
    const failedJobCleanupTimer = setInterval(
      cleanupFailedJobs,
      24 * 60 * 60 * 1000,
    );
    failedJobCleanupTimer.unref(); // Don't keep process alive for this alone

    /**
     * Graceful shutdown handler
     */
    const shutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info(`Worker shutdown signal received: ${signal}`);
      clearInterval(failedJobCleanupTimer);

      try {
        if (_rabbitMQBus) {
          await _rabbitMQBus.close();
          _rabbitMQBus = null;
        }

        // Stop all queue processors
        logger.info("Closing queue manager...");
        await queueManager.closeAll();
        clearJobQueuesRuntime();

        // Close database pool
        logger.info("Closing database pool...");
        await pool.end();

        logger.info("Worker shut down gracefully");
        process.exit(0);
      } catch (error) {
        logger.error("Error during graceful shutdown", {
          error: error.message,
        });
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Global error handlers – attempt a quick shutdown before exiting
    process.on("uncaughtException", async (error) => {
      logger.error("Uncaught exception in worker", {
        error: error.message,
        stack: error.stack,
      });
      if (!isShuttingDown) {
        isShuttingDown = true;
        clearInterval(failedJobCleanupTimer);
        try {
          await queueManager.closeAll();
          clearJobQueuesRuntime();
          await pool.end();
        } catch (_) {
          // Ignore shutdown errors during forced exit
        }
      }
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason, promise) => {
      logger.error("Unhandled rejection in worker", {
        reason: String(reason),
        promise: String(promise),
      });
      if (!isShuttingDown) {
        isShuttingDown = true;
        clearInterval(failedJobCleanupTimer);
        try {
          await queueManager.closeAll();
          clearJobQueuesRuntime();
          await pool.end();
        } catch (_) {
          // Ignore shutdown errors during forced exit
        }
      }
      process.exit(1);
    });

    logger.info("Worker process started successfully");
    logger.info(`Listening for jobs on: ${queueNames.join(", ")}`);
  } catch (error) {
    logger.error("Failed to start worker process", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Start the worker
startWorker();
