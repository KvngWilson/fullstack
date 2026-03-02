/**
 * Response time tracking middleware
 * Measures and logs API response times
 */

const ResponseTimeTracker = (slowThreshold = 200) => {
  return (req, res, next) => {
    // Record start time with nanosecond precision
    const start = process.hrtime.bigint();
    
    // Original send method
    const originalSend = res.send;
    const originalJson = res.json;
    
    /**
     * Helper to calculate duration and emit metrics
     */
    const finishRequest = (method, data = null) => {
      const duration = Number(process.hrtime.bigint() - start) / 1_000_000; // milliseconds
      
      // Add response time header
      res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      
      // Log slow requests
      if (duration > slowThreshold) {
        console.warn(
          `⚠️  SLOW: ${req.method} ${req.path} - ${duration.toFixed(2)}ms`
        );
      }
      
      // Emit metric event for monitoring
      process.emit('http-metric', {
        timestamp: Date.now(),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: parseFloat(duration.toFixed(2)),
        isSlow: duration > slowThreshold,
      });
      
      // Return original method result
      return method.call(this, data);
    };
    
    // Override send method
    res.send = function(data) {
      return finishRequest(originalSend, data);
    };
    
    // Override json method
    res.json = function(data) {
      return finishRequest(originalJson, data);
    };
    
    next();
  };
};

/**
 * Metrics aggregator for performance analysis
 * Collects and summarizes response time data
 */
class MetricsAggregator {
  constructor() {
    this.metrics = [];
    this.maxSize = 1000; // Keep last 1000 requests
    
    // Listen for metric events
    process.on('http-metric', (metric) => {
      this.addMetric(metric);
    });
  }
  
  addMetric(metric) {
    this.metrics.push(metric);
    
    // Keep array size manageable
    if (this.metrics.length > this.maxSize) {
      this.metrics = this.metrics.slice(-this.maxSize);
    }
  }
  
  /**
   * Get statistics for all metrics
   */
  getStats() {
    if (this.metrics.length === 0) {
      return null;
    }
    
    const durations = this.metrics.map(m => m.duration).sort((a, b) => a - b);
    const slowRequests = this.metrics.filter(m => m.isSlow);
    
    return {
      totalRequests: this.metrics.length,
      slowRequests: slowRequests.length,
      slowRequestPercent: ((slowRequests.length / this.metrics.length) * 100).toFixed(2),
      avgDuration: this.percentile(durations, 0.5).toFixed(2),
      p95Duration: this.percentile(durations, 0.95).toFixed(2),
      p99Duration: this.percentile(durations, 0.99).toFixed(2),
      minDuration: Math.min(...durations).toFixed(2),
      maxDuration: Math.max(...durations).toFixed(2),
      byMethod: this.groupByMethod(),
      byPath: this.groupByPath(),
    };
  }
  
  /**
   * Get statistics for specific endpoint
   */
  getEndpointStats(method, path) {
    const endpoint = this.metrics.filter(m => m.method === method && m.path === path);
    
    if (endpoint.length === 0) {
      return null;
    }
    
    const durations = endpoint.map(m => m.duration).sort((a, b) => a - b);
    
    return {
      method,
      path,
      requests: endpoint.length,
      avgDuration: this.percentile(durations, 0.5).toFixed(2),
      p95Duration: this.percentile(durations, 0.95).toFixed(2),
      slowCount: endpoint.filter(m => m.isSlow).length,
    };
  }
  
  /**
   * Get slowest endpoints
   */
  getSlowestEndpoints(limit = 10) {
    const endpoints = {};
    
    this.metrics.forEach(m => {
      const key = `${m.method} ${m.path}`;
      if (!endpoints[key]) {
        endpoints[key] = [];
      }
      endpoints[key].push(m.duration);
    });
    
    return Object.entries(endpoints)
      .map(([endpoint, durations]) => ({
        endpoint,
        avgDuration: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2),
        maxDuration: Math.max(...durations).toFixed(2),
        count: durations.length,
      }))
      .sort((a, b) => parseFloat(b.avgDuration) - parseFloat(a.avgDuration))
      .slice(0, limit);
  }
  
  /**
   * Group metrics by HTTP method
   */
  groupByMethod() {
    const grouped = {};
    
    this.metrics.forEach(m => {
      if (!grouped[m.method]) {
        grouped[m.method] = { count: 0, totalDuration: 0 };
      }
      grouped[m.method].count += 1;
      grouped[m.method].totalDuration += m.duration;
    });
    
    const result = {};
    Object.entries(grouped).forEach(([method, data]) => {
      result[method] = (data.totalDuration / data.count).toFixed(2);
    });
    
    return result;
  }
  
  /**
   * Group metrics by path
   */
  groupByPath() {
    const grouped = {};
    
    this.metrics.forEach(m => {
      if (!grouped[m.path]) {
        grouped[m.path] = { count: 0, totalDuration: 0 };
      }
      grouped[m.path].count += 1;
      grouped[m.path].totalDuration += m.duration;
    });
    
    const result = {};
    Object.entries(grouped)
      .sort((a, b) => b[1].totalDuration - a[1].totalDuration)
      .slice(0, 15)
      .forEach(([path, data]) => {
        result[path] = (data.totalDuration / data.count).toFixed(2);
      });
    
    return result;
  }
  
  /**
   * Calculate percentile
   */
  percentile(sorted, p) {
    const index = sorted.length * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
  
  clear() {
    this.metrics = [];
  }
}

// Create global aggregator instance
const aggregator = new MetricsAggregator();

module.exports = {
  ResponseTimeTracker,
  aggregator,
};
