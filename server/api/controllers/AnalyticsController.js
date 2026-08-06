/**
 * Analytics Controller
 * 
 * Handles analytics dashboard and metrics
 */
const Joi = require("joi");

class AnalyticsController {
  constructor(salesAnalyticsService) {
    this.salesAnalyticsService = salesAnalyticsService;
  }

  /**
   * Get dashboard overview
   * GET /api/v1/analytics/dashboard
   */
  async getDashboard(req, res, next) {
    try {
      // Check admin or vendor role
      if (!["admin", "vendor"].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: "Insufficient permissions",
        });
      }

      const vendorId = req.user.role === "vendor" ? req.user.vendorId : req.query.vendorId;
      const timeRange = req.query.timeRange || "month";

      const overview = await this.salesAnalyticsService.getDashboardOverview(
        vendorId,
        timeRange
      );

      res.json({
        success: true,
        data: overview,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get sales trend
   * GET /api/v1/analytics/sales-trend
   */
  async getSalesTrend(req, res, next) {
    try {
      const { vendorId, period = "daily", days = 30 } = req.query;

      // Validate vendor access
      if (req.user.role === "vendor" && req.user.vendorId !== vendorId) {
        return res.status(403).json({
          success: false,
          error: "Cannot access other vendor's analytics",
        });
      }

      const trend = await this.salesAnalyticsService.getSalesTrend(
        vendorId,
        period,
        parseInt(days)
      );

      res.json({
        success: true,
        data: trend,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get revenue by category
   * GET /api/v1/analytics/revenue-by-category
   */
  async getRevenueByCategory(req, res, next) {
    try {
      const { vendorId, timeRange = "month" } = req.query;

      // Validate vendor access
      if (req.user.role === "vendor" && req.user.vendorId !== vendorId) {
        return res.status(403).json({
          success: false,
          error: "Cannot access other vendor's analytics",
        });
      }

      const data = await this.salesAnalyticsService.getRevenueByCategory(vendorId, timeRange);

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get payment method breakdown
   * GET /api/v1/analytics/payment-methods
   */
  async getPaymentMethodBreakdown(req, res, next) {
    try {
      const { vendorId, timeRange = "month" } = req.query;

      // Validate vendor access
      if (req.user.role === "vendor" && req.user.vendorId !== vendorId) {
        return res.status(403).json({
          success: false,
          error: "Cannot access other vendor's analytics",
        });
      }

      const data = await this.salesAnalyticsService.getPaymentMethodBreakdown(vendorId, timeRange);

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Export analytics report
   * GET /api/v1/analytics/export
   */
  async exportReport(req, res, next) {
    try {
      const { vendorId, format = "pdf", timeRange = "month" } = req.query;

      if (!["pdf", "csv", "excel"].includes(format)) {
        return res.status(400).json({
          success: false,
          error: "Invalid export format",
        });
      }

      // Check permissions
      if (req.user.role === "vendor" && req.user.vendorId !== vendorId) {
        return res.status(403).json({
          success: false,
          error: "Cannot export other vendor's analytics",
        });
      }

      const overview = await this.salesAnalyticsService.getDashboardOverview(vendorId, timeRange);
      const trend = await this.salesAnalyticsService.getSalesTrend(vendorId, "daily", 30);
      const revenue = await this.salesAnalyticsService.getRevenueByCategory(vendorId, timeRange);

      const report = {
        generatedAt: new Date().toISOString(),
        overview,
        trend,
        revenue,
      };

      // Format response based on format type
      if (format === "csv") {
        res.type("text/csv");
        res.attachment(`analytics-report-${Date.now()}.csv`);
        res.send(this._convertToCSV(report));
      } else {
        res.json({
          success: true,
          data: report,
        });
      }
    } catch (err) {
      next(err);
    }
  }

  _convertToCSV(report) {
    let csv = "Analytics Report\n";
    csv += `Generated: ${report.generatedAt}\n\n`;

    csv += "Dashboard Overview\n";
    Object.entries(report.overview).forEach(([key, value]) => {
      csv += `${key},${JSON.stringify(value)}\n`;
    });

    return csv;
  }
}

module.exports = AnalyticsController;
