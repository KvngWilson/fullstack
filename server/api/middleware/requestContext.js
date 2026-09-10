/**
 * Request Context Middleware
 * Adds correlation ID and tracing context to requests for observability
 */

const {
  createTracingMiddleware,
} = require("../../infrastructure/observability/tracing/tracingMiddleware");

const correlationIdMiddleware = createTracingMiddleware({
  headerName: 'x-correlation-id',
});

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
