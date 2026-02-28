const winston = require("winston");
const path = require("path");
const { v4: uuid } = require("uuid");

const LOG_DIR = path.join(__dirname, "../logs");
const isProduction = process.env.NODE_ENV === "production";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

// Base log format (JSON with timestamp and error stack)
const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Console format (colorized and human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}: ${message}${metaString}`;
  }),
);

// Build transports based on environment
function buildTransports() {
  const transports = [];

  // Console
  transports.push(
    new winston.transports.Console({
      format: isProduction ? baseFormat : consoleFormat,
    }),
  );

  if (isProduction) {
    transports.push(
      new winston.transports.File({
        filename: path.join(LOG_DIR, "error.log"),
        level: "error",
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(LOG_DIR, "combined.log"),
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),
    );
  }

  return transports;
}

// Create the main logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: baseFormat,
  defaultMeta: {
    service: "ecommerce-api",
    environment: process.env.NODE_ENV || "development",
  },
  transports: buildTransports(),
});

// Create request-scoped logger
function requestLoggerMiddleware(req, res, next) {
  const requestId = uuid();
  const start = process.hrtime.bigint();

  // Attach child logger to request
  req.logger = logger.child({ requestId });

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    req.logger.info("HTTP Request", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${durationMs.toFixed(2)}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      userId: req.user?.id,
    });
  });

  next();
}

module.exports = logger;
module.exports.logger = logger;
module.exports.requestLoggerMiddleware = requestLoggerMiddleware;

