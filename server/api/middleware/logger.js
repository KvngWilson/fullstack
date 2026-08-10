/**
 * Request Logging Middleware
 * 
 * Logs incoming requests and responses
 * Useful for debugging and monitoring
 */

const { logger } = require('../../shared/utils/logger');

/**
 * Log incoming HTTP requests
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
  });
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
    });
    
    originalSend.call(this, data);
  };
  
  next();
}

/**
 * Log slow requests (> 1000ms)
 */
function slowRequestLogger(req, res, next) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id,
      });
    }
  });
  
  next();
}

/**
 * Log errors in requests
 */
function errorLogger(err, req, res, next) {
  logger.error('Request error', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    userId: req.user?.id,
  });
  
  next(err);
}

module.exports = {
  requestLogger,
  slowRequestLogger,
  errorLogger,
};