const TracingContext = require('./TracingContext');

/**
 * Factory for request tracing middleware.
 *
 * This is intentionally NOT wired into app bootstrap yet.
 * It can be imported and mounted later when tracing rollout begins.
 */
function createTracingMiddleware(options = {}) {
  const headerName = options.headerName || 'x-correlation-id';

  return function tracingMiddleware(req, res, next) {
    const incomingCorrelationId = req.headers[headerName] || req.headers[headerName.toLowerCase()];
    const tracingContext = new TracingContext(incomingCorrelationId);

    req.tracingContext = tracingContext;
    res.setHeader('X-Correlation-ID', tracingContext.correlationId);

    const requestSpan = tracingContext.startSpan('http.request');
    tracingContext.addTag(requestSpan, 'http.method', req.method);
    tracingContext.addTag(requestSpan, 'http.path', req.originalUrl || req.url);

    res.on('finish', () => {
      tracingContext.addTag(requestSpan, 'http.status_code', res.statusCode);
      tracingContext.endSpan(requestSpan);
    });

    next();
  };
}

module.exports = {
  createTracingMiddleware,
};
