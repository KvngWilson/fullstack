const crypto = require("crypto");

const REQURIED_ENV_VARS = [
  "NODE_ENV",
  "PORT",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
  "SESSION_SECRET",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_PASSWORD",
];

const SECRET_MIN_LENGTH = 32;

class EnvValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EnvValidationError";
  }
}

function validateEnv() {
  console.log("Validating environment variables...");
  // Check NODE_ENV
  const validEnvs = ["development", "test", "production"];
  if (!validEnvs.includes(process.env.NODE_ENV)) {
    throw new EnvValidationError(
      `NODE_ENV must be one of: ${validEnvs.join(", ")}`,
    );
  }

  // Check required variables
  const missing = REQUIRED_ENV_VARS.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new EnvValidationError(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join("\n")}`,
    );
  }

  // Validate secret strength
  const secrets = ["JWT_SECRET", "SESSION_SECRET"];
  for (const secret of secrets) {
    if (process.env[secret].length < SECRET_MIN_LENGTH) {
      throw new EnvValidationError(
        `${secret} must be at least ${SECRET_MIN_LENGTH} characters (current: ${process.env[secret].length})`,
      );
    }

    // Check for weak defaults
    const weakDefaults = [
      "jwt-secret-key",
      "session-secret-key",
      "secret",
      "password",
      "12345",
    ];
    if (
      weakDefaults.some((weak) =>
        process.env[secret].toLowerCase().includes(weak),
      )
    ) {
      throw new EnvValidationError(
        `${secret} appears to be a weak/default value. Use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      );
    }
  }

  // Validate database config
  const dbPort = parseInt(process.env.DB_PORT);
  if (isNaN(dbPort) || dbPort < 1 || dbPort > 65535) {
    throw new EnvValidationError(
      "DB_PORT must be a valid port number (1-65535)",
    );
  }

  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    if (process.env.DB_HOST === "localhost") {
      console.warn("WARNING: Using localhost database in production");
    }

    if (!process.env.REDIS_PASSWORD) {
      throw new EnvValidationError("REDIS_PASSWORD is required in production");
    }
  }

  console.log("Environment validation passed");
}

function generateSecrets() {
  console.log("\n🔐 Generate secure secrets for .env file:\n");
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
