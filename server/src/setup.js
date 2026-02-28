const { testConnection, closePool } = require("../config/db");
const { connectRedis, redisClient } = require("../config/redis");
const { logger } = require("../utils/logger");

const SHUTDOWN_TIMEOUT_MS = 30_000;

// Bootstrap application dependencies
async function bootstrap() {
  await testConnection();
  await connectRedis();
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
