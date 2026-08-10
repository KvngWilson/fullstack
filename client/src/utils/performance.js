/**
 * Performance Monitoring & Analytics
 * Tracks Core Web Vitals and application performance metrics
 */

/**
 * Track Core Web Vitals
 * - LCP (Largest Contentful Paint)
 * - FID (First Input Delay)
 * - CLS (Cumulative Layout Shift)
 * - INP (Interaction to Next Paint)
 */
export function initWebVitalsTracking(onMetric) {
  // LCP - measure.type: 'largest-contentful-paint'
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        onMetric({
          metric: 'LCP',
          value: lastEntry.renderTime || lastEntry.loadTime,
          rating: getVitalsRating('LCP', lastEntry.renderTime || lastEntry.loadTime),
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('LCP monitoring not available', e);
    }
  }

  // FID - measure.type: 'first-input'
  if ('PerformanceObserver' in window) {
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          onMetric({
            metric: 'FID',
            value: entry.processingDuration,
            rating: getVitalsRating('FID', entry.processingDuration),
          });
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      console.warn('FID monitoring not available', e);
    }
  }

  // CLS - cumulative layout shift
  if ('PerformanceObserver' in window) {
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            onMetric({
              metric: 'CLS',
              value: clsValue,
              rating: getVitalsRating('CLS', clsValue),
            });
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('CLS monitoring not available', e);
    }
  }
}

/**
 * Get vitals rating (good, needs improvement, poor)
 */
function getVitalsRating(metric, value) {
  const thresholds = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    INP: { good: 200, poor: 500 },
    CLS: { good: 0.1, poor: 0.25 },
  };

  const { good, poor } = thresholds[metric] || {};

  if (value <= good) return 'Good';
  if (value <= poor) return 'Needs Improvement';
  return 'Poor';
}

/**
 * Track resource timing
 * Measures JavaScript bundle size, CSS, images, etc.
 */
export function trackResourceMetrics() {
  if (!('performance' in window)) return;

  const resources = performance.getEntriesByType('resource');
  const metrics = {
    scripts: { count: 0, totalSize: 0 },
    styles: { count: 0, totalSize: 0 },
    images: { count: 0, totalSize: 0 },
    other: { count: 0, totalSize: 0 },
  };

  resources.forEach((resource) => {
    const size = resource.transferSize || 0;

    if (resource.name.includes('.js')) {
      metrics.scripts.count++;
      metrics.scripts.totalSize += size;
    } else if (resource.name.includes('.css')) {
      metrics.styles.count++;
      metrics.styles.totalSize += size;
    } else if (/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(resource.name)) {
      metrics.images.count++;
      metrics.images.totalSize += size;
    } else {
      metrics.other.count++;
      metrics.other.totalSize += size;
    }
  });

  return metrics;
}

/**
 * Track memory usage (if available)
 */
export function trackMemoryMetrics() {
  if (!('memory' in performance)) return null;

  const memory = performance.memory;
  return {
    usedJsHeapSize: memory.usedJSHeapSize,
    totalJsHeapSize: memory.totalJSHeapSize,
    heapSizeLimit: memory.jsHeapSizeLimit,
    usagePercentage: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2),
  };
}

/**
 * Track page load timing
 */
export function getPageLoadMetrics() {
  if (!('performance' in window)) return null;

  const navigation = performance.getEntriesByType('navigation')[0];
  if (!navigation) return null;

  return {
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    ttfb: navigation.responseStart - navigation.requestStart,
    dom: navigation.domInteractive - navigation.responseEnd,
    load: navigation.loadEventEnd - navigation.loadEventStart,
    total: navigation.loadEventEnd - navigation.fetchStart,
  };
}

/**
 * Report metrics to analytics service
 */
export function reportMetrics(data) {
  // Send to your analytics service
  if (typeof navigator.sendBeacon === 'function') {
    const url = '/api/v1/analytics/metrics';
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } else {
    // Fallback to fetch
    fetch('/api/v1/analytics/metrics', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch((e) => console.warn('Failed to report metrics', e));
  }
}

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring(config = {}) {
  const { reportInterval = 30000, reportUrl: _reportUrl = '/api/v1/analytics/metrics' } = config;

  // Track vitals
  initWebVitalsTracking((metric) => {
    console.debug('Web Vital:', metric);
  });

  // Report metrics periodically
  setInterval(() => {
    const pageLoad = getPageLoadMetrics();
    const resources = trackResourceMetrics();
    const memory = trackMemoryMetrics();

    reportMetrics({
      timestamp: new Date().toISOString(),
      pageLoad,
      resources,
      memory,
      url: window.location.href,
    });
  }, reportInterval);
}

/**
 * Performance mark & measure helpers
 */
export const performanceMarkers = {
  startMeasure(name) {
    if ('performance' in window) {
      performance.mark(`${name}-start`);
    }
  },

  endMeasure(name) {
    if ('performance' in window) {
      performance.mark(`${name}-end`);
      try {
        performance.measure(name, `${name}-start`, `${name}-end`);
        const measure = performance.getEntriesByName(name)[0];
        console.debug(`[TIMING] ${name}: ${measure.duration.toFixed(2)}ms`);
        return measure.duration;
      } catch (e) {
        console.warn(`Failed to measure ${name}`, e);
      }
    }
  },
};

/**
 * React Profiler integration
 * Use with <Profiler> component
 */
export function onRenderCallback(id, phase, actualDuration, baseDuration, _startTime, _commitTime) {
  if (actualDuration > 16) { // > 1 frame at 60fps
    console.warn(
      `[WARN] Slow render [${id}]: ${actualDuration.toFixed(2)}ms (base: ${baseDuration.toFixed(2)}ms)`
    );
  }
}

/**
 * Bundle size analyzer
 * Log information about bundle contents
 */
export function analyzeBundleSize() {
  const resources = performance.getEntriesByType('resource');
  const jsResources = resources.filter((r) => r.name.includes('.js'));

  jsResources.sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0)).forEach((resource) => {
    const sizeKb = ((resource.transferSize || 0) / 1024).toFixed(2);
    console.log(`${sizeKb}kb - ${new URL(resource.name).pathname}`);
  });
}
