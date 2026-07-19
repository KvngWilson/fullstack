/**
 * Standardized async error handling utilities
 * Provides consistent patterns for fire-and-forget operations across the application
 * Similar to response.js standardization pattern
 */

const logger = require('./logger');

/**
 * Standard error context structure for consistent logging
 * @typedef {Object} AsyncErrorContext
 * @property {string} operation - Operation name for logging
 * @property {string|number} [id] - Entity ID (orderId, productId, etc.)
 * @property {string} [userId] - User performing the operation
 * @property {string} [severity] - Error severity (error, warn, info)
 * @property {Object} [metadata] - Additional context data
 */

/**
 * Build consistent async error context
 * @param {Partial<AsyncErrorContext>} context
 * @returns {AsyncErrorContext}
 */
function buildAsyncErrorContext({
  operation,
  id = null,
  userId = null,
  severity = 'error',
  metadata = {}
}) {
  return {
    operation,
    ...(id && { id }),
    ...(userId && { userId }),
    severity,
    ...(Object.keys(metadata).length && { metadata })
  };
}

/**
 * Fire-and-forget async operations with consistent error logging
 * Used for non-critical async tasks (events, emails, notifications)
 * that shouldn't block or fail the main flow
 *
 * @param {Function} asyncFn - Async function to execute
 * @param {Partial<AsyncErrorContext>} context - Operation context
 * @returns {void} - Fire and forget, no promise returned
 *
 * @example
 * fireAndForgetWithErrorLog(
 *   () => this._publishOrderCreatedEvent(orderId),
 *   { operation: 'publishOrderCreatedEvent', id: orderId }
 * )
 */
function fireAndForgetWithErrorLog(asyncFn, context = {}) {
  const errorContext = buildAsyncErrorContext({
    operation: context.operation || 'unknown',
    severity: 'warn',
    ...context
  });

  Promise.resolve(asyncFn()).catch(error => {
    const logData = {
      error: error.message,
      stack: error.stack,
      ...errorContext
    };

    const logMessage = `Async operation failed: ${errorContext.operation}`;
    
    if (errorContext.severity === 'error') {
      logger.error(logMessage, logData);
    } else if (errorContext.severity === 'warn') {
      logger.warn(logMessage, logData);
    } else {
      logger.info(logMessage, logData);
    }
  });
}

/**
 * Fire-and-forget with retry logic for flaky operations
 * Retries the operation with exponential backoff
 *
 * @param {Function} asyncFn - Async function to execute
 * @param {Partial<AsyncErrorContext>} context - Operation context
 * @param {Object} options - Retry configuration
 * @param {number} [options.maxRetries=3] - Maximum retry attempts
 * @param {number} [options.initialDelay=1000] - Initial delay in ms
 * @returns {void}
 *
 * @example
 * fireAndForgetWithRetry(
 *   () => sendEmail(user.email, template),
 *   { operation: 'sendWelcomeEmail', userId: user.id },
 *   { maxRetries: 3, initialDelay: 1000 }
 * )
 */
function fireAndForgetWithRetry(
  asyncFn,
  context = {},
  { maxRetries = 3, initialDelay = 1000 } = {}
) {
  const errorContext = buildAsyncErrorContext({
    operation: context.operation || 'unknown',
    ...context
  });

  let retryCount = 0;

  const executeWithRetry = () => {
    Promise.resolve(asyncFn())
      .catch(error => {
        if (retryCount < maxRetries) {
          retryCount++;
          const delayMs = initialDelay * Math.pow(2, retryCount - 1);
          
          logger.warn(
            `Async operation retry ${retryCount}/${maxRetries}: ${errorContext.operation}`,
            { error: error.message, delayMs, ...errorContext }
          );

          setTimeout(executeWithRetry, delayMs);
        } else {
          logger.error(
            `Async operation failed after ${maxRetries} retries: ${errorContext.operation}`,
            { error: error.message, retryCount, ...errorContext }
          );
        }
      });
  };

  executeWithRetry();
}

/**
 * Fire-and-forget with timeout
 * Fails if operation doesn't complete within specified time
 *
 * @param {Function} asyncFn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {Partial<AsyncErrorContext>} context - Operation context
 * @returns {void}
 *
 * @example
 * fireAndForgetWithTimeout(
 *   () => uploadFile(file, s3Bucket),
 *   5000,
 *   { operation: 'uploadProfilePicture', userId: user.id }
 * )
 */
function fireAndForgetWithTimeout(asyncFn, timeoutMs, context = {}) {
  const errorContext = buildAsyncErrorContext({
    operation: context.operation || 'unknown',
    ...context
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
      timeoutMs
    )
  );

  Promise.race([Promise.resolve(asyncFn()), timeoutPromise])
    .catch(error => {
      logger.warn(
        `Async operation failed: ${errorContext.operation}`,
        {
          error: error.message,
          timeoutMs,
          ...errorContext
        }
      );
    });
}

/**
 * Parallel fire-and-forget operations with error aggregation
 * Executes multiple async operations concurrently with consistent error handling
 *
 * @param {Array<{fn: Function, context: Partial<AsyncErrorContext>}>} operations - Array of operations
 * @returns {void}
 *
 * @example
 * fireAndForgetParallel([
 *   { fn: () => publishEvent(event), context: { operation: 'publishEvent' } },
 *   { fn: () => sendEmail(email), context: { operation: 'sendEmail' } },
 *   { fn: () => updateCache(key), context: { operation: 'updateCache' } }
 * ])
 */
function fireAndForgetParallel(operations = []) {
  operations.forEach(({ fn, context }) => {
    fireAndForgetWithErrorLog(fn, context);
  });
}

module.exports = {
  fireAndForgetWithErrorLog,
  fireAndForgetWithRetry,
  fireAndForgetWithTimeout,
  fireAndForgetParallel,
  buildAsyncErrorContext
};
