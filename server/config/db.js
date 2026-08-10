const { Pool } = require("pg");
const logger = require("../shared/utils/logger");

const shouldUseSsl =
  process.env.DB_SSL_ENABLED === "true" ||
  (!!process.env.DB_SSL_CA || !!process.env.DB_SSL_CERT || !!process.env.DB_SSL_KEY);

// Default to false for self-signed certs (e.g. local Docker). Set DB_SSL_REJECT_UNAUTHORIZED=true
// in production when using a CA-signed certificate.
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";

const poolConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "ecommerce_db",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",

  // Aggressive pooling for high concurrency (100k+ users)
  max: parseInt(process.env.DB_POOL_MAX) || 100,
  min: parseInt(process.env.DB_POOL_MIN) || 10,
  
  // Connection timeouts
  idleTimeoutMillis: 30000,           // Close idle connections after 30s
  connectionTimeoutMillis: 5000,      // Timeout when acquiring connection
  statementTimeoutMillis: 30000,      // Kill long-running queries after 30s
  
  // Application name for monitoring
  application_name: process.env.APP_NAME || 'fullstack-backend',
  
  // SSL configuration (explicitly opt-in via DB_SSL_ENABLED=true or SSL cert vars)
  ssl: shouldUseSsl
    ? {
        rejectUnauthorized,
        ca: process.env.DB_SSL_CA ? [process.env.DB_SSL_CA] : undefined,
        cert: process.env.DB_SSL_CERT || undefined,
        key: process.env.DB_SSL_KEY || undefined,
      }
    : false,
  
  // Allow duplicate of replication client config
  allowExitOnIdle: process.env.NODE_ENV === 'test',
};

const pool = new Pool(poolConfig);

/**
 * Monitor pool health and log statistics periodically
 */
const MONITOR_INTERVAL = 60000; // 1 minute
let monitoringInterval = null;

function startPoolMonitoring() {
  monitoringInterval = setInterval(() => {
    logger.info('Database pool stats', {
      totalConnections: pool.totalCount,
      activeConnections: pool.totalCount - pool.idleCount,
      idleConnections: pool.idleCount,
      waitingRequests: pool.waitingCount,
      maxConnections: pool.options.max,
      minConnections: pool.options.min
    });
  }, MONITOR_INTERVAL);
  
  monitoringInterval.unref(); // Don't prevent process exit
}

/**
 * Connection event handlers
 */
pool.on("connect", (client) => {
  logger.debug("Database connection established", { 
    poolSize: pool.totalCount 
  });
});

pool.on("error", (err, client) => {
  logger.error("Unexpected database connection error", { 
    error: err.message,
    code: err.code,
    poolSize: pool.totalCount 
  });
  
  // Only exit on critical errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    logger.error("Database server unreachable, exiting");
    process.exit(1);
  }
});

pool.on("remove", () => {
  logger.debug("Database connection removed", { 
    poolSize: pool.totalCount
  });
});

/**
 * Test database connection on startup
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    logger.info("Database connection successful", { 
      timestamp: result.rows[0].now,
      poolSize: pool.totalCount
    });
    client.release();
    return true;
  } catch (error) {
    logger.error("Database connection test failed", { 
      error: error.message,
      code: error.code 
    });
    throw error;
  }
}

/**
 * Graceful pool shutdown
 */
async function closePool() {
  logger.info("Closing database connections");
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  await pool.end();
  logger.info("Database connection pool closed");
}

/**
 * Query wrapper with enhanced error handling
 */
async function query(...args) {
  const startTime = Date.now();
  
  try {
    const result = await pool.query(...args);
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      logger.warn("Slow database query", {
        query: args[0]?.substring(0, 100),
        duration
      });
    }
    
    return result;
  } catch (error) {
    logger.error("Database query error", {
      error: error.message,
      query: args[0]?.substring(0, 100),
      duration: Date.now() - startTime
    });
    throw error;
  }
}

// Start monitoring on module load (skip in tests to avoid open handle leaks)
if (process.env.NODE_ENV !== 'test') {
  startPoolMonitoring();
}

module.exports = {
  pool,
  testConnection,
  closePool,
  query,
  connect: (...args) => pool.connect(...args),
  end: (...args) => pool.end(...args),
  getPoolStats: () => ({
    total: pool.totalCount,
    active: pool.totalCount - pool.idleCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  })
};
