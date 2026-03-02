/**
 * Metrics Middleware
 * Collects application metrics for monitoring and observability
 */

const MetricsRegistry = require('../../infrastructure/metrics/MetricsRegistry');

// Global metrics registry
const metrics = new MetricsRegistry();

// Initialize standard metrics
function initializeMetrics() {
  metrics.registerCounter('http_requests_total', 'Total HTTP requests');
  metrics.registerCounter('http_requests_errors_total', 'Total HTTP errors');
  metrics.registerHistogram('http_request_duration_ms', [10, 50, 100, 500, 1000, 5000], 'HTTP request duration');
  metrics.registerGauge('active_connections', 'Current active connections');
}

/**
 * Middleware to collect HTTP metrics
 */
function metricsMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  
  // Increment request counter
  metrics.incrementCounter('http_requests_total');
  metrics.setGauge('active_connections', metrics.metrics.get('gauge_active_connections')?.value + 1 || 1);
  
  res.on('finish', () => {
    // Record duration
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    metrics.observeHistogram('http_request_duration_ms', durationMs);
    
    // Track errors
    if (res.statusCode >= 400) {
      metrics.incrementCounter('http_requests_errors_total');
    }
    
    // Decrement active connections
    const currentConnections = metrics.metrics.get('gauge_active_connections')?.value || 0;
    metrics.setGauge('active_connections', Math.max(0, currentConnections - 1));
  });
  
  next();
}

/**
 * Endpoint to expose metrics (Prometheus format compatible)
 */
function metricsEndpoint(req, res) {
  const allMetrics = metrics.getMetrics();
  
  // Simple text format for metrics
  let output = '';
  
  for (const [key, metric] of Object.entries(allMetrics)) {
    const metricName = key.replace(/^(counter|histogram|gauge)_/, '');
    
    if (metric.type === 'counter' || metric.type === 'gauge') {
      output += `# TYPE ${metricName} ${metric.type}\n`;
      output += `${metricName} ${metric.value}\n`;
    } else if (metric.type === 'histogram' && metric.observations) {
      output += `# TYPE ${metricName} histogram\n`;
      const values = metric.observations;
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const count = values.length;
        output += `${metricName}_sum ${sum}\n`;
        output += `${metricName}_count ${count}\n`;
      }
    }
    output += '\n';
  }
  
  res.set('Content-Type', 'text/plain');
  res.send(output);
}

/**
 * Get current metrics snapshot
 */
function getMetricsSnapshot() {
  return metrics.getMetrics();
}

// Initialize metrics on load
initializeMetrics();

module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  getMetricsSnapshot,
  metrics,
};
