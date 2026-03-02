/**
 * Metrics Registry - For observability (Phase 5)
 *
 * Tracks:
 * - Counters (requests, errors, etc.)
 * - Histograms (latencies)
 * - Gauges (active connections)
 *
 * For now: stub for migration compatibility
 */

class MetricsRegistry {
  constructor() {
    this.metrics = new Map();
  }

  registerCounter(name, help = "") {
    this.metrics.set(`counter_${name}`, { type: "counter", value: 0, help });
  }

  registerHistogram(name, buckets = [], help = "") {
    this.metrics.set(`histogram_${name}`, { type: "histogram", buckets, help });
  }

  registerGauge(name, help = "") {
    this.metrics.set(`gauge_${name}`, { type: "gauge", value: 0, help });
  }

  incrementCounter(name, value = 1) {
    const key = `counter_${name}`;
    if (this.metrics.has(key)) {
      this.metrics.get(key).value += value;
    }
  }

  observeHistogram(name, value) {
    const key = `histogram_${name}`;
    if (this.metrics.has(key)) {
      this.metrics.get(key).observations =
        this.metrics.get(key).observations || [];
      this.metrics.get(key).observations.push(value);
    }
  }

  setGauge(name, value) {
    const key = `gauge_${name}`;
    if (this.metrics.has(key)) {
      this.metrics.get(key).value = value;
    }
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
}

module.exports = MetricsRegistry;
