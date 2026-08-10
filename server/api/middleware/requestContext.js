/**
 * Request Context Middleware
 * Adds correlation ID and tracing context to requests for observability
 */

const { v4: uuidv4 } = require('uuid');

// Add correlation ID to requests for distributed tracing
function correlationIdMiddleware(req, res, next) {
  // Use existing correlation ID from header or generate new one
  const correlationId = req.headers['x-correlation-id'] || 
                        req.headers['x-request-id'] || 
                        uuidv4();
  
  // Attach to request
  req.correlationId = correlationId;
  
  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Attach to logger if available
  if (req.logger) {
    req.logger = req.logger.child({ correlationId });
  }
  
  next();
}

// Add request timing for performance monitoring
function requestTimingMiddleware(req, res, next) {
  req.startTime = process.hrtime.bigint();

  const originalWriteHead = res.writeHead;
  res.writeHead = function writeHeadWithTiming(...args) {
    if (!res.getHeader('X-Response-Time')) {
      const durationMs = Number(process.hrtime.bigint() - req.startTime) / 1_000_000;
      res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    }
    return originalWriteHead.apply(this, args);
  };

  next();
}

module.exports = {
  correlationIdMiddleware,
  requestTimingMiddleware,
};
