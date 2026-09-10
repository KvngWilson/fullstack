/**
 * Metrics Middleware
 * Collects application metrics for monitoring and observability
 */

const MetricsRegistry = require("../../infrastructure/observability/metrics/MetricsRegistry");

// Global metrics registry
const metrics = new MetricsRegistry();

// Initialize standard metrics
function initializeMetrics() {
  metrics.registerCounter("http_requests_total", "Total HTTP requests");
  metrics.registerCounter("http_requests_errors_total", "Total HTTP errors");
  metrics.registerCounter("http_metrics_scrapes_total", "Total /metrics scrapes");
  metrics.registerCounter("http_requests_by_route_total", "Total HTTP requests by route", {
    labelNames: ["method", "route", "status_code"],
  });
  metrics.registerHistogram(
    "http_request_duration_ms",
    [10, 50, 100, 500, 1000, 5000],
    "HTTP request duration in milliseconds",
    {
      labelNames: ["method", "route", "status_code"],
    },
  );
  metrics.registerGauge("active_connections", "Current active connections");
  metrics.registerGauge("process_resident_memory_bytes", "Resident memory usage in bytes");
  metrics.registerGauge("process_heap_used_bytes", "Heap memory usage in bytes");
  metrics.registerGauge("process_uptime_seconds", "Process uptime in seconds");
  metrics.registerCollector(() => {
    const memoryUsage = process.memoryUsage();
    metrics.setGauge("process_resident_memory_bytes", memoryUsage.rss);
    metrics.setGauge("process_heap_used_bytes", memoryUsage.heapUsed);
    metrics.setGauge("process_uptime_seconds", process.uptime());
  });
}

function getRouteLabel(req) {
  if (req.route?.path) {
    const routePath = typeof req.route.path === "string" ? req.route.path : "dynamic";
    return `${req.baseUrl || ""}${routePath}` || "unknown";
  }

  const path = (req.originalUrl || req.url || "").split("?")[0];
  if (!path) {
    return "unknown";
  }

  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":uuid")
    .replace(/\/\d+(?=\/|$)/g, "/:id");
}

// Middleware to collect HTTP metrics
function metricsMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  let connectionReleased = false;

  metrics.incrementGauge("active_connections", 1);

  function releaseConnection() {
    if (connectionReleased) {
      return;
    }
    connectionReleased = true;
    metrics.decrementGauge("active_connections", 1);
  }

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    const labels = {
      method: req.method,
      route: getRouteLabel(req),
      status_code: String(res.statusCode),
    };

    metrics.incrementCounter("http_requests_total");
    metrics.incrementCounter("http_requests_by_route_total", 1, labels);
    metrics.observeHistogram("http_request_duration_ms", durationMs, labels);

    if (res.statusCode >= 400) {
      metrics.incrementCounter("http_requests_errors_total");
    }

    releaseConnection();
  });

  res.on("close", releaseConnection);
  next();
}

// Endpoint to expose metrics (Prometheus format compatible)
function metricsEndpoint(req, res) {
  metrics.incrementCounter("http_metrics_scrapes_total");
  metrics.collect();
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(metrics.toPrometheus());
}

// Get current metrics snapshot
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
