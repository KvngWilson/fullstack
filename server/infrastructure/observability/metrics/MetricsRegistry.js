/**
 * Metrics Registry
 *
 * Tracks:
 * - Counters (requests, errors, etc.)
 * - Histograms (latencies)
 * - Gauges (active connections)
 *
 * Exposes Prometheus text format and backwards-compatible snapshot objects.
 */

const DEFAULT_HISTOGRAM_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const DEFAULT_SERIES_KEY = '__default__';

class MetricsRegistry {
  constructor() {
    this.metrics = new Map();
    this.collectors = [];
  }

  registerCounter(name, help = '', options = {}) {
    const { resolvedHelp, labelNames } = this._resolveMetricOptions(help, options);
    this.metrics.set(name, {
      type: 'counter',
      name,
      help: resolvedHelp,
      labelNames,
      series: new Map(),
    });
  }

  registerHistogram(name, bucketsOrOptions = [], help = '', options = {}) {
    const buckets = Array.isArray(bucketsOrOptions)
      ? bucketsOrOptions
      : bucketsOrOptions?.buckets;
    const mergedOptions = Array.isArray(bucketsOrOptions)
      ? options
      : { ...bucketsOrOptions, ...options };
    const { resolvedHelp, labelNames } = this._resolveMetricOptions(help, mergedOptions);
    this.metrics.set(name, {
      type: 'histogram',
      name,
      help: resolvedHelp,
      labelNames,
      buckets: this._normalizeBuckets(buckets),
      series: new Map(),
    });
  }

  registerGauge(name, help = '', options = {}) {
    const { resolvedHelp, labelNames } = this._resolveMetricOptions(help, options);
    this.metrics.set(name, {
      type: 'gauge',
      name,
      help: resolvedHelp,
      labelNames,
      series: new Map(),
    });
  }

  registerCollector(collector) {
    if (typeof collector !== 'function') {
      throw new Error('collector must be a function');
    }
    this.collectors.push(collector);
  }

  collect() {
    for (const collector of this.collectors) {
      collector();
    }
  }

  incrementCounter(name, value = 1, labels = {}) {
    const metric = this._getMetric(name, 'counter');
    const series = this._getOrCreateSeries(metric, labels, () => 0);
    metric.series.set(series.key, series.value + Number(value || 0));
  }

  observeHistogram(name, value, labels = {}) {
    const metric = this._getMetric(name, 'histogram');
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return;
    }
    const series = this._getOrCreateSeries(metric, labels, () => ({
      sum: 0,
      count: 0,
      bucketCounts: new Array(metric.buckets.length + 1).fill(0),
    }));

    series.value.sum += numericValue;
    series.value.count += 1;

    const bucketIndex = metric.buckets.findIndex((bucket) => numericValue <= bucket);
    const normalizedBucketIndex =
      bucketIndex === -1 ? metric.buckets.length : bucketIndex;
    series.value.bucketCounts[normalizedBucketIndex] += 1;
    metric.series.set(series.key, series.value);
  }

  setGauge(name, value, labels = {}) {
    const metric = this._getMetric(name, 'gauge');
    const numericValue = Number(value || 0);
    const series = this._normalizeSeriesLabels(metric, labels);
    metric.series.set(series.key, Number.isFinite(numericValue) ? numericValue : 0);
  }

  incrementGauge(name, value = 1, labels = {}) {
    const metric = this._getMetric(name, 'gauge');
    const series = this._getOrCreateSeries(metric, labels, () => 0);
    metric.series.set(series.key, series.value + Number(value || 0));
  }

  decrementGauge(name, value = 1, labels = {}) {
    this.incrementGauge(name, -Number(value || 0), labels);
  }

  toPrometheus() {
    const lines = [];

    for (const metric of this.metrics.values()) {
      if (metric.help) {
        lines.push(`# HELP ${metric.name} ${this._escapeHelp(metric.help)}`);
      }
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'histogram') {
        this._appendHistogramLines(lines, metric);
      } else {
        this._appendCounterGaugeLines(lines, metric);
      }

      lines.push('');
    }

    return `${lines.join('\n').trim()}\n`;
  }

  getSnapshot() {
    const snapshot = {};

    for (const metric of this.metrics.values()) {
      if (metric.type === 'histogram') {
        const histogramStats = this._histogramStats(metric);
        snapshot[`histogram_${metric.name}`] = {
          type: 'histogram',
          help: metric.help,
          buckets: metric.buckets,
          count: histogramStats.count,
          sum: histogramStats.sum,
          avg: histogramStats.count > 0 ? histogramStats.sum / histogramStats.count : 0,
          seriesCount: metric.series.size,
        };
        continue;
      }

      const total = Array.from(metric.series.values()).reduce(
        (accumulator, value) => accumulator + Number(value || 0),
        0,
      );
      snapshot[`${metric.type}_${metric.name}`] = {
        type: metric.type,
        help: metric.help,
        value: total,
        seriesCount: metric.series.size,
      };
    }

    return snapshot;
  }

  getMetrics() {
    return this.getSnapshot();
  }

  _appendCounterGaugeLines(lines, metric) {
    if (metric.series.size === 0) {
      lines.push(`${metric.name} 0`);
      return;
    }

    for (const [seriesKey, value] of metric.series.entries()) {
      const labels = this._decodeSeriesKey(metric, seriesKey);
      const labelSet = this._formatLabels(labels);
      lines.push(`${metric.name}${labelSet} ${Number(value || 0)}`);
    }
  }

  _appendHistogramLines(lines, metric) {
    if (metric.series.size === 0) {
      const emptyLabels = this._formatLabels({ le: '+Inf' });
      lines.push(`${metric.name}_bucket${emptyLabels} 0`);
      lines.push(`${metric.name}_sum 0`);
      lines.push(`${metric.name}_count 0`);
      return;
    }

    for (const [seriesKey, distribution] of metric.series.entries()) {
      const labels = this._decodeSeriesKey(metric, seriesKey);
      let cumulativeCount = 0;

      for (let index = 0; index < metric.buckets.length; index += 1) {
        cumulativeCount += distribution.bucketCounts[index] || 0;
        const bucketLabels = this._formatLabels({
          ...labels,
          le: String(metric.buckets[index]),
        });
        lines.push(`${metric.name}_bucket${bucketLabels} ${cumulativeCount}`);
      }

      cumulativeCount += distribution.bucketCounts[metric.buckets.length] || 0;
      const infinityBucketLabels = this._formatLabels({ ...labels, le: '+Inf' });
      lines.push(`${metric.name}_bucket${infinityBucketLabels} ${cumulativeCount}`);
      lines.push(`${metric.name}_sum${this._formatLabels(labels)} ${distribution.sum}`);
      lines.push(`${metric.name}_count${this._formatLabels(labels)} ${distribution.count}`);
    }
  }

  _histogramStats(metric) {
    let count = 0;
    let sum = 0;
    for (const distribution of metric.series.values()) {
      count += distribution.count;
      sum += distribution.sum;
    }
    return { count, sum };
  }

  _getMetric(name, expectedType) {
    const metric = this.metrics.get(name);
    if (!metric) {
      throw new Error(`Metric "${name}" is not registered`);
    }
    if (expectedType && metric.type !== expectedType) {
      throw new Error(`Metric "${name}" is not a ${expectedType}`);
    }
    return metric;
  }

  _resolveMetricOptions(help, options = {}) {
    if (help && typeof help === 'object') {
      return {
        resolvedHelp: help.help || '',
        labelNames: this._normalizeLabelNames(help.labelNames || []),
      };
    }

    return {
      resolvedHelp: String(help || ''),
      labelNames: this._normalizeLabelNames(options.labelNames || []),
    };
  }

  _normalizeBuckets(buckets) {
    const source = Array.isArray(buckets) && buckets.length > 0
      ? buckets
      : DEFAULT_HISTOGRAM_BUCKETS;
    return Array.from(
      new Set(source.map((value) => Number(value)).filter((value) => Number.isFinite(value))),
    ).sort((left, right) => left - right);
  }

  _normalizeLabelNames(labelNames) {
    if (!Array.isArray(labelNames)) {
      return [];
    }
    return Array.from(
      new Set(
        labelNames
          .map((name) => String(name || '').trim())
          .filter((name) => name.length > 0),
      ),
    );
  }

  _normalizeSeriesLabels(metric, labels = {}) {
    if (!metric.labelNames.length) {
      return { key: DEFAULT_SERIES_KEY, labels: {} };
    }

    const normalizedLabels = {};
    for (const labelName of metric.labelNames) {
      normalizedLabels[labelName] = this._normalizeLabelValue(labels[labelName]);
    }

    return {
      labels: normalizedLabels,
      key: JSON.stringify(normalizedLabels),
    };
  }

  _getOrCreateSeries(metric, labels, defaultValueFactory) {
    const series = this._normalizeSeriesLabels(metric, labels);
    if (!metric.series.has(series.key)) {
      metric.series.set(series.key, defaultValueFactory());
    }
    return {
      key: series.key,
      value: metric.series.get(series.key),
    };
  }

  _decodeSeriesKey(metric, seriesKey) {
    if (!metric.labelNames.length || seriesKey === DEFAULT_SERIES_KEY) {
      return {};
    }
    return JSON.parse(seriesKey);
  }

  _formatLabels(labels) {
    const entries = Object.entries(labels || {}).filter(
      ([, value]) => value !== undefined && value !== null,
    );
    if (entries.length === 0) {
      return '';
    }

    const formattedEntries = entries.map(
      ([key, value]) => `${key}="${this._escapeLabelValue(String(value))}"`,
    );
    return `{${formattedEntries.join(',')}}`;
  }

  _normalizeLabelValue(value) {
    if (value === undefined || value === null || value === '') {
      return 'unknown';
    }
    return String(value);
  }

  _escapeHelp(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
  }

  _escapeLabelValue(value) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/"/g, '\\"');
  }
}

module.exports = MetricsRegistry;
