/**
 * Logging Module Entry Point
 * Exports logging functionality for use throughout the application
 */

const logger = require('../../shared/utils/logger');
const StructuredLogger = require('./StructuredLogger');

module.exports = {
  logger,
  StructuredLogger,
};
