const { testConnection, closePool } = require("../config/db");
const { connectRedis, redisClient } = require("../config/redis");
const { logger } = require("../shared/utils/logger");
const { initializeJobs } = require("../infrastructure/jobs/tasks/initializeJobs");
const { initializeJobQueues, shutdownJobQueues } = require("../infrastructure/jobs/initializeQueues");
const { sendEmailJob } = require("../infrastructure/email/email");
const { createWebhookHandlers } = require("../infrastructure/jobs/handlers/webhookHandlers");
const {
  setJobQueuesRuntime,
  clearJobQueuesRuntime,
} = require("../infrastructure/jobs/runtime");
const dispatcher = require("../domain/shared/events/dispatcher");

const SHUTDOWN_TIMEOUT_MS = 30_000;
let queueRuntime = null;
let _rabbitMQBus = null;

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
        const message = result?.error?.message || result?.error || "Email send failed";
        throw new Error(message);
      }

      return result;
    },
  };
}

/**
 * Initialise RabbitMQ transport when RABBITMQ_URL is set.
 * Falls back silently to the in-memory bus when the broker is unavailable,
 * so the API stays operational in development without a running broker.
 */
async function initRabbitMQ() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    logger.info("RABBITMQ_URL not set; using in-memory EventBus");
    return;
  }

  try {
    const RabbitMQEventBus = require("../infrastructure/messaging/rabbitMqEventBus");
    const bus = new RabbitMQEventBus({ url });
    await bus.connect();
    dispatcher.init(bus);
    _rabbitMQBus = bus;
    logger.info("RabbitMQ EventBus active");
  } catch (err) {
    logger.warn("RabbitMQ unavailable; falling back to in-memory EventBus", {
      error: err.message,
    });
  }
}

// Bootstrap application dependencies
async function bootstrap() {
  await testConnection();
  await connectRedis();
  await initializeJobs();

  // Must initialise transport BEFORE registerDomainSubscribers() in app.js
  await initRabbitMQ();

  try {
    queueRuntime = await initializeJobQueues(createEmailServiceAdapter(), createWebhookHandlers());
    setJobQueuesRuntime(queueRuntime);
  } catch (error) {
    queueRuntime = null;
    clearJobQueuesRuntime();
    logger.warn("Background job queues unavailable; continuing without Bull queues", {
      error: error.message,
    });
  }
}

// Start HTTP server
function createHttpServer(app, port) {
  const server = app.listen(port, () => {
    logger.info("Server running", { port });
    logger.info("API documentation available", {
      url: `http://localhost:${port}/api-docs`,
    });
  });

  return server;
}

// Close external resources
async function closeResources() {
  if (_rabbitMQBus) {
    await _rabbitMQBus.close();
    _rabbitMQBus = null;
  }

  if (queueRuntime?.queueManager) {
    await shutdownJobQueues(queueRuntime.queueManager);
    queueRuntime = null;
    clearJobQueuesRuntime();
  }

  await closePool();

  if (redisClient?.isOpen) {
    await redisClient.quit();
    logger.info("Redis connection closed");
  }
}

// Create graceful shutdown handler
function createShutdownHandler(server) {
  let shuttingDown = false;

  return async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info("Graceful shutdown initiated", { signal });

    const forceExit = setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          const isNotRunningError =
            err?.code === "ERR_SERVER_NOT_RUNNING" ||
            err?.message?.includes("ERR_SERVER_NOT_RUNNING");

          if (!err || isNotRunningError) {
            resolve();
            return;
          }

          reject(err);
        });
      });

      logger.info("HTTP server closed");

      await closeResources();

      clearTimeout(forceExit);
      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExit);
      logger.error("Error during shutdown", { error });
      process.exit(1);
    }
  };
}

// Register process signal handlers
function registerSignalHandlers(handler) {
  ["SIGTERM", "SIGINT"].forEach((signal) =>
    process.on(signal, () => handler(signal)),
  );
}

// Application entrypoint
async function startServer({ app, port }) {
  try {
    if (!app) {
      throw new Error("Express app is required to start server");
    }

    await bootstrap();
    const server = createHttpServer(app, port);

    const shutdown = createShutdownHandler(server);
    registerSignalHandlers(shutdown);

    return server; // useful for testing
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
}

module.exports = { startServer };
