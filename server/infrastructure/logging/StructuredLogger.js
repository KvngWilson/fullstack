const logger = require("../../shared/utils/logger");

/**
 * Structured Logger.
 * Wraps child logger creation for component-scoped structured logs.
 */
class StructuredLogger {
  constructor(name) {
    this.logger =
      typeof logger.child === "function" ? logger.child({ component: name }) : logger;
  }

  debug(message, context = {}) {
    this.logger.debug(message, context);
  }

  info(message, context = {}) {
    this.logger.info(message, context);
  }

  warn(message, context = {}) {
    this.logger.warn(message, context);
  }

  error(message, context = {}, error = null) {
    if (error) {
      return this.logger.error(message, { ...context, error: error.message, stack: error.stack });
    }
    return this.logger.error(message, context);
  }
}

module.exports = StructuredLogger;
