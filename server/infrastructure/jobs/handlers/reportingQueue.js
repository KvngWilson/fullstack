const { logger } = require("../../../shared/utils/logger");

class ReportingQueue {
  constructor(queue, dbPool, redisClient) {
    this.queue = queue;
    this.dbPool = dbPool;
    this.redisClient = redisClient;
    this.setupProcessor();
  }

  setupProcessor() {
    this.queue.process(async (job) => {
      const { type, vendorId = null, timeRange = "today" } = job.data || {};

      logger.info("Processing reporting job", {
        jobId: job.id,
        type,
        vendorId,
        timeRange,
        attempt: job.attemptsMade + 1,
      });

      const result = await this.handle(type, { vendorId, timeRange, ...job.data });

      logger.info("Reporting job completed", {
        jobId: job.id,
        type,
        vendorId,
      });

      return result;
    });
  }

  async handle(type, payload = {}) {
    switch (type) {
      case "dashboard-overview":
        return this.getDashboardOverview(payload.vendorId, payload.timeRange);
      case "sales-trend":
        return this.getSalesTrend(payload.vendorId, payload.period, payload.daysBack);
      case "revenue-by-category":
        return this.getRevenueByCategory(payload.vendorId, payload.limit);
      case "payment-breakdown":
        return this.getPaymentMethodBreakdown(payload.vendorId);
      default:
        throw new Error(`Unsupported reporting job type: ${type}`);
    }
  }

  async queueReport(type, payload = {}, options = {}) {
    return this.queue.add(
      { type, ...payload },
      {
        jobId: `report:${type}:${Date.now()}`,
        priority: 5,
        ...options,
      },
    );
  }

  async getDashboardOverview(vendorId = null, timeRange = "today") {
    const [totalRevenue, orderCount, averageOrderValue, topProducts, topCategories] =
      await Promise.all([
        this._getTotalRevenue(vendorId, timeRange),
        this._getOrderCount(vendorId, timeRange),
        this._getAverageOrderValue(vendorId, timeRange),
        this._getTopProducts(vendorId, timeRange, 5),
        this._getTopCategories(vendorId, timeRange, 5),
      ]);

    const overview = {
      totalRevenue,
      orderCount,
      averageOrderValue,
      topProducts,
      topCategories,
      timestamp: new Date().toISOString(),
    };

    await this._cacheReport("dashboard-overview", vendorId, timeRange, overview);
    return overview;
  }

  async getSalesTrend(vendorId = null, period = "daily", daysBack = 30) {
    const safeDaysBack = Number.isFinite(Number(daysBack)) ? Number(daysBack) : 30;
    const query = `
      SELECT
        DATE(o.created_at) AS date,
        COUNT(*) AS order_count,
        COALESCE(SUM(total_cents), 0) / 100.0 AS revenue,
        COALESCE(AVG(total_cents), 0) / 100.0 AS avg_order_value
      FROM orders o
      WHERE o.created_at >= NOW() - INTERVAL '${safeDaysBack} days'
      ${vendorId ? "AND o.vendor_id = $1" : ""}
      AND o.deleted_at IS NULL
      GROUP BY DATE(o.created_at)
      ORDER BY date ASC
    `;

    const result = await this.dbPool.query(query, vendorId ? [vendorId] : []);
    const trend = result.rows.map((row) => ({
      date: row.date,
      orders: Number(row.order_count),
      revenue: Number(row.revenue),
      averageOrderValue: Number(row.avg_order_value),
      period,
    }));

    await this._cacheReport("sales-trend", vendorId, `${period}:${safeDaysBack}`, trend);
    return trend;
  }

  async getRevenueByCategory(vendorId = null, limit = 10) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const query = `
      SELECT
        c.id,
        c.name,
        COUNT(oi.id) AS order_count,
        COALESCE(SUM(oi.quantity), 0) AS total_quantity,
        COALESCE(SUM(oi.subtotal_cents), 0) / 100.0 AS revenue
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      LEFT JOIN order_items oi ON pv.id = oi.product_variant_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE o.deleted_at IS NULL
      ${vendorId ? "AND p.vendor_id = $1" : ""}
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
      LIMIT $${vendorId ? 2 : 1}
    `;

    const result = await this.dbPool.query(
      query,
      vendorId ? [vendorId, safeLimit] : [safeLimit],
    );

    return result.rows.map((row) => ({
      categoryId: row.id,
      categoryName: row.name,
      orderCount: Number(row.order_count),
      totalQuantity: Number(row.total_quantity),
      revenue: Number(row.revenue),
    }));
  }

  async getPaymentMethodBreakdown(vendorId = null) {
    const query = `
      SELECT
        p.payment_method,
        COUNT(*) AS count,
        COALESCE(SUM(p.amount_cents), 0) / 100.0 AS total_amount,
        COALESCE(AVG(p.amount_cents), 0) / 100.0 AS avg_amount
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE p.status = 'completed'
      ${vendorId ? "AND o.vendor_id = $1" : ""}
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `;

    const result = await this.dbPool.query(query, vendorId ? [vendorId] : []);

    return result.rows.map((row) => ({
      paymentMethod: row.payment_method,
      count: Number(row.count),
      totalAmount: Number(row.total_amount),
      averageAmount: Number(row.avg_amount),
    }));
  }

  async _getTotalRevenue(vendorId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    const query = `
      SELECT COALESCE(SUM(total_cents), 0) / 100.0 AS revenue
      FROM orders o
      WHERE ${dateFilter}
      ${vendorId ? "AND o.vendor_id = $1" : ""}
      AND o.deleted_at IS NULL
    `;

    const result = await this.dbPool.query(query, vendorId ? [vendorId] : []);
    return Number(result.rows[0].revenue);
  }

  async _getOrderCount(vendorId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    const query = `
      SELECT COUNT(*) AS count
      FROM orders o
      WHERE ${dateFilter}
      ${vendorId ? "AND o.vendor_id = $1" : ""}
      AND o.deleted_at IS NULL
    `;

    const result = await this.dbPool.query(query, vendorId ? [vendorId] : []);
    return Number(result.rows[0].count);
  }

  async _getAverageOrderValue(vendorId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    const query = `
      SELECT COALESCE(AVG(total_cents), 0) / 100.0 AS avg_value
      FROM orders o
      WHERE ${dateFilter}
      ${vendorId ? "AND o.vendor_id = $1" : ""}
      AND o.deleted_at IS NULL
    `;

    const result = await this.dbPool.query(query, vendorId ? [vendorId] : []);
    return Number(result.rows[0].avg_value);
  }

  async _getTopProducts(vendorId, timeRange, limit) {
    const dateFilter = this._getDateFilter(timeRange);
    const query = `
      SELECT
        pv.id AS product_variant_id,
        pv.sku,
        COALESCE(SUM(oi.quantity), 0) AS quantity_sold,
        COALESCE(SUM(oi.subtotal_cents), 0) / 100.0 AS revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN product_variants pv ON oi.product_variant_id = pv.id
      WHERE ${dateFilter}
      ${vendorId ? "AND pv.vendor_id = $1" : ""}
      AND o.deleted_at IS NULL
      GROUP BY pv.id, pv.sku
      ORDER BY revenue DESC
      LIMIT $${vendorId ? 2 : 1}
    `;

    const result = await this.dbPool.query(
      query,
      vendorId ? [vendorId, limit] : [limit],
    );

    return result.rows;
  }

  async _getTopCategories(vendorId, timeRange, limit) {
    const dateFilter = this._getDateFilter(timeRange);
    const query = `
      SELECT
        c.id,
        c.name,
        COALESCE(SUM(oi.subtotal_cents), 0) / 100.0 AS revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN product_variants pv ON oi.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE ${dateFilter}
      ${vendorId ? "AND p.vendor_id = $1" : ""}
      AND o.deleted_at IS NULL
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
      LIMIT $${vendorId ? 2 : 1}
    `;

    const result = await this.dbPool.query(
      query,
      vendorId ? [vendorId, limit] : [limit],
    );

    return result.rows;
  }

  _getDateFilter(timeRange) {
    switch (timeRange) {
      case "today":
        return "o.created_at >= CURRENT_DATE";
      case "week":
        return "o.created_at >= NOW() - INTERVAL '7 days'";
      case "month":
        return "o.created_at >= NOW() - INTERVAL '30 days'";
      default:
        return "o.created_at >= NOW() - INTERVAL '24 hours'";
    }
  }

  async _cacheReport(type, vendorId, keySuffix, payload) {
    if (!this.redisClient?.setEx) {
      return;
    }

    const cacheKey = `reports:${type}:${vendorId || "all"}:${keySuffix}`;
    await this.redisClient.setEx(cacheKey, 3600, JSON.stringify(payload));
  }
}

module.exports = ReportingQueue;
