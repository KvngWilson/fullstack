/**
 * Sales Analytics Service
 * 
 * Provides comprehensive sales metrics and analytics
 */
const logger = require("../../config/logger");
const redis = require("redis");

class SalesAnalyticsService {
  constructor(pool, redisClient) {
    this.pool = pool;
    this.redisClient = redisClient;
    this.CACHE_EXPIRY = 3600; // 1 hour
  }

  /**
   * Get dashboard overview metrics
   */
  async getDashboardOverview(vendorId = null, timeRange = "today") {
    const cacheKey = `analytics:dashboard:${vendorId || "all"}:${timeRange}`;
    
    // Try cache first
    const cached = await this.redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const [
        totalRevenue,
        orderCount,
        conversionRate,
        averageOrderValue,
        topProducts,
        topCategories,
      ] = await Promise.all([
        this._getTotalRevenue(vendorId, timeRange),
        this._getOrderCount(vendorId, timeRange),
        this._getConversionRate(vendorId, timeRange),
        this._getAverageOrderValue(vendorId, timeRange),
        this._getTopProducts(vendorId, timeRange, 5),
        this._getTopCategories(vendorId, timeRange, 5),
      ]);

      const overview = {
        totalRevenue,
        orderCount,
        conversionRate,
        averageOrderValue,
        topProducts,
        topCategories,
        timestamp: new Date(),
      };

      // Cache result
      await this.redisClient.setEx(
        cacheKey,
        this.CACHE_EXPIRY,
        JSON.stringify(overview)
      );

      return overview;
    } catch (error) {
      logger.error("Failed to get dashboard overview", { vendorId, error });
      throw error;
    }
  }

  /**
   * Get sales trend over time
   */
  async getSalesTrend(vendorId = null, period = "daily", daysBack = 30) {
    const cacheKey = `analytics:sales-trend:${vendorId || "all"}:${period}:${daysBack}`;

    const cached = await this.redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as order_count,
          COALESCE(SUM(total_amount), 0) as revenue,
          AVG(total_amount) as avg_order_value
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '${daysBack} days'
        ${vendorId ? "AND vendor_id = $1" : ""}
        AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const result = await this.pool.query(
        query,
        vendorId ? [vendorId] : []
      );

      const trend = result.rows.map((row) => ({
        date: row.date,
        orders: parseInt(row.order_count),
        revenue: parseFloat(row.revenue),
        averageOrderValue: parseFloat(row.avg_order_value),
      }));

      // Cache result
      await this.redisClient.setEx(
        cacheKey,
        this.CACHE_EXPIRY,
        JSON.stringify(trend)
      );

      return trend;
    } catch (error) {
      logger.error("Failed to get sales trend", { vendorId, error });
      throw error;
    }
  }

  /**
   * Get revenue by category
   */
  async getRevenueByCategory(vendorId = null, limit = 10) {
    try {
      const query = `
        SELECT 
          c.id,
          c.name,
          COUNT(o.id) as order_count,
          COALESCE(SUM(oi.quantity), 0) as total_quantity,
          COALESCE(SUM(oi.unit_price * oi.quantity), 0) as revenue
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id
        ${vendorId ? "WHERE p.vendor_id = $1" : ""}
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
        LIMIT $${vendorId ? 2 : 1}
      `;

      const result = await this.pool.query(
        query,
        vendorId ? [vendorId, limit] : [limit]
      );

      return result.rows.map((row) => ({
        categoryId: row.id,
        categoryName: row.name,
        orderCount: parseInt(row.order_count),
        totalQuantity: parseInt(row.total_quantity),
        revenue: parseFloat(row.revenue),
      }));
    } catch (error) {
      logger.error("Failed to get revenue by category", { vendorId, error });
      throw error;
    }
  }

  /**
   * Get payment method breakdown
   */
  async getPaymentMethodBreakdown(vendorId = null) {
    try {
      const query = `
        SELECT 
          p.payment_method,
          COUNT(*) as count,
          COALESCE(SUM(p.amount), 0) as total_amount,
          AVG(p.amount) as avg_amount
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        ${vendorId ? "WHERE o.vendor_id = $1" : ""}
        AND p.status = 'completed'
        GROUP BY p.payment_method
        ORDER BY total_amount DESC
      `;

      const result = await this.pool.query(
        query,
        vendorId ? [vendorId] : []
      );

      return result.rows.map((row) => ({
        paymentMethod: row.payment_method,
        count: parseInt(row.count),
        totalAmount: parseFloat(row.total_amount),
        averageAmount: parseFloat(row.avg_amount),
      }));
    } catch (error) {
      logger.error("Failed to get payment method breakdown", { vendorId, error });
      throw error;
    }
  }

  // Private helper methods
  async _getTotalRevenue(vendorId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    const query = `
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE ${dateFilter}
      ${vendorId ? "AND vendor_id = $1" : ""}
      AND status != 'cancelled'
    `;

    const result = await this.pool.query(
      query,
      vendorId ? [vendorId] : []
    );
    return parseFloat(result.rows[0].revenue);
  }

  async _getOrderCount(vendorId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    const query = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE ${dateFilter}
      ${vendorId ? "AND vendor_id = $1" : ""}
      AND status != 'cancelled'
    `;

    const result = await this.pool.query(
      query,
      vendorId ? [vendorId] : []
    );
    return parseInt(result.rows[0].count);
  }

  async _getConversionRate(vendorId, timeRange) {
    // This would need to integrate with your cart/checkout tracking
    return 2.5; // Placeholder
  }

  async _getAverageOrderValue(vendorId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    const query = `
      SELECT AVG(total_amount) as avg_value
      FROM orders
      WHERE ${dateFilter}
      ${vendorId ? "AND vendor_id = $1" : ""}
      AND status != 'cancelled'
    `;

    const result = await this.pool.query(
      query,
      vendorId ? [vendorId] : []
    );
    return parseFloat(result.rows[0].avg_value) || 0;
  }

  async _getTopProducts(vendorId, timeRange, limit = 5) {
    const dateFilter = this._getDateFilter(timeRange);
    const query = `
      SELECT 
        p.id,
        p.name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.unit_price) as revenue
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE ${dateFilter}
      ${vendorId ? "AND p.vendor_id = $1" : ""}
      AND o.status != 'cancelled'
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT $${vendorId ? 2 : 1}
    `;

    const result = await this.pool.query(
      query,
      vendorId ? [vendorId, limit] : [limit]
    );

    return result.rows.map((row) => ({
      productId: row.id,
      productName: row.name,
      quantity: parseInt(row.total_quantity),
      revenue: parseFloat(row.revenue),
    }));
  }

  async _getTopCategories(vendorId, timeRange, limit = 5) {
    return this.getRevenueByCategory(vendorId, limit);
  }

  _getDateFilter(timeRange) {
    const filters = {
      today: "created_at >= CURRENT_DATE",
      week: "created_at >= CURRENT_DATE - INTERVAL '7 days'",
      month: "created_at >= CURRENT_DATE - INTERVAL '30 days'",
      quarter: "created_at >= CURRENT_DATE - INTERVAL '90 days'",
      year: "created_at >= DATE_TRUNC('year', NOW())",
    };
    return filters[timeRange] || filters.month;
  }
}

module.exports = SalesAnalyticsService;
