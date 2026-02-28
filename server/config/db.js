const { Pool } = require("pg");
const { logger } = require("../utils/logger");

const poolConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Connection pool configuration
  max: parseInt(process.env.DB_POOL_MAX) || 20, // Maximum connections
  min: parseInt(process.env.DB_POOL_MIN) || 2, // Minimum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout when acquiring connection

  ssl: false,
};

const pool = new Pool(poolConfig);

// Connection event handlers
pool.on("connect", (client) => {
  logger.info("Database connection established");
});

pool.on("error", (err, client) => {
  logger.error("Unexpected database error", { error: err });
  process.exit(-1);
});

pool.on("remove", () => {
  logger.info("Client removed from pool");
});

// Test connection on startup
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    logger.info("Database connected", { timestamp: result.rows[0].now });
    client.release();
    return true;
  } catch (error) {
    logger.error("Database connection failed", { error: error.message });
    throw error;
  }
}

// Graceful shutdown
async function closePool() {
  logger.info("Closing database connections");
  await pool.end();
  logger.info("Database connections closed");
}

module.exports = {
  pool,
  testConnection,
  closePool,
  query: (...args) => pool.query(...args),
  connect: (...args) => pool.connect(...args),
  end: (...args) => pool.end(...args),
};
