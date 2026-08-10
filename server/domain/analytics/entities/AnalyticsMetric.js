/**
 * Analytics Metric Entity
 * 
 * Represents aggregated metrics for the analytics dashboard
 */
class AnalyticsMetric {
  constructor({
    id = null,
    metricType, // sales, customers, products, orders, payments, etc
    metricName, // specific metric name
    value = 0,
    unit = null, // USD, count, percent, etc
    timestamp = null,
    period = "daily", // hourly, daily, weekly, monthly
    vendorId = null, // optional - for vendor-specific metrics
    metadata = {},
  } = {}) {
    this.id = id;
    this.metricType = metricType;
    this.metricName = metricName;
    this.value = value;
    this.unit = unit;
    this.timestamp = timestamp || new Date();
    this.period = period;
    this.vendorId = vendorId;
    this.metadata = metadata;
  }

  /**
   * Calculate percentage change from previous value
   */
  calculatePercentageChange(previousValue) {
    if (previousValue === 0) {
      return this.value > 0 ? 100 : 0;
    }
    return ((this.value - previousValue) / previousValue) * 100;
  }

  /**
   * Format metric value for display
   */
  formatValue() {
    const formats = {
      USD: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(this.value),
      percent: `${this.value.toFixed(2)}%`,
      count: Number(this.value).toLocaleString(),
      default: this.value,
    };

    return formats[this.unit] || formats.default;
  }
}

module.exports = AnalyticsMetric;
