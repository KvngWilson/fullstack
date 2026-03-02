const crypto = require("crypto");
const { logger } = require("../shared/utils/logger");

const SECRET_MIN_LENGTH = 32;

/**
 * Environment validation error for missing or invalid config.
 */
class EnvValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EnvValidationError";
  }
}

function validateEnv() {
  logger.info("Validating environment variables");
  // Check NODE_ENV
  const validEnvs = ["development", "test", "production"];
  if (!validEnvs.includes(process.env.NODE_ENV)) {
    throw new EnvValidationError(
      `NODE_ENV must be one of: ${validEnvs.join(", ")}`,
    );
  }

  // Validate secret strength
  const secrets = ["JWT_SECRET", "SESSION_SECRET"];
  for (const secret of secrets) {
    const secretValue = process.env[secret];

    if (!secretValue) {
      throw new EnvValidationError(`${secret} is required`);
    }

    if (secretValue.length < SECRET_MIN_LENGTH) {
      throw new EnvValidationError(
        `${secret} must be at least ${SECRET_MIN_LENGTH} characters (current: ${secretValue.length})`,
      );
    }
  }

  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    if (process.env.DB_HOST === "localhost") {
      logger.warn("Using localhost database in production", {
        dbHost: process.env.DB_HOST,
      });
    }

    if (!process.env.REDIS_PASSWORD) {
      throw new EnvValidationError("REDIS_PASSWORD is required in production");
    }
  }

  logger.info("Environment validation passed");
}

function generateSecrets() {
  console.log("\n[SECURE] Generate secure secrets for .env file:\n");
  console.log(`JWT_SECRET=${crypto.randomBytes(32).toString("hex")}`);
  console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString("hex")}`);
  console.log(`REDIS_PASSWORD=${crypto.randomBytes(16).toString("hex")}`);
  console.log("");
}

module.exports = {
  validateEnv,
  generateSecrets,
  EnvValidationError,
};
