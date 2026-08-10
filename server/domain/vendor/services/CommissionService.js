/**
 * Commission Service
 * 
 * Manages vendor commission calculation, tracking, and payouts
 */
const logger = require("../../config/logger");

class CommissionService {
  constructor(pool, orderRepository, payoutRepository, redisClient) {
    this.pool = pool;
    this.orderRepository = orderRepository;
    this.payoutRepository = payoutRepository;
    this.redisClient = redisClient;
  }

  /**
   * Calculate commission for an order
   */
  async calculateOrderCommission(orderId) {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      // Get vendor commission rate
      const commissionRate = await this._getVendorCommissionRate(order.vendor_id);

      // Calculate commission amount
      const commissionAmount = order.total_amount * (commissionRate / 100);

      // Deduct platform fee from vendor earnings
      const vendorEarnings = order.total_amount - commissionAmount;

      return {
        orderId,
        vendorId: order.vendor_id,
        orderAmount: order.total_amount,
        commissionRate,
        commissionAmount,
        vendorEarnings,
        tax: this._calculateTax(commissionAmount),
      };
    } catch (error) {
      logger.error("Failed to calculate commission", { orderId, error });
      throw error;
    }
  }

  /**
   * Set vendor commission rate
   */
  async setVendorCommissionRate(vendorId, rate, reason = null) {
    try {
      if (rate < 0 || rate > 100) {
        throw new Error("Commission rate must be between 0 and 100");
      }

      const query = `
        INSERT INTO vendor_commission_settings (vendor_id, commission_rate, effective_from, reason)
        VALUES ($1, $2, NOW(), $3)
        ON CONFLICT (vendor_id) 
        DO UPDATE SET commission_rate = $2, effective_from = NOW(), reason = $3
      `;

      await this.pool.query(query, [vendorId, rate, reason]);

      // Invalidate cache
      await this.redisClient.del(`vendor:commission:${vendorId}`);

      logger.info("Vendor commission rate updated", { vendorId, rate });
      return { vendorId, rate };
    } catch (error) {
      logger.error("Failed to set commission rate", { vendorId, error });
      throw error;
    }
  }

  /**
   * Get vendor earnings summary
   */
  async getVendorEarnings(vendorId, startDate = null, endDate = null) {
    const cacheKey = `earnings:${vendorId}:${startDate}:${endDate}`;
    const cached = await this.redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const dateWhere = this._buildDateWhere(startDate, endDate);

      const query = `
        SELECT 
          COUNT(DISTINCT o.id) as order_count,
          SUM(o.total_amount) as total_sales,
          SUM(
            o.total_amount - (o.total_amount * COALESCE(vcs.commission_rate, 15) / 100)
          ) as total_earnings,
          AVG(o.total_amount) as avg_order_value,
          MIN(o.created_at) as period_start,
          MAX(o.created_at) as period_end
        FROM orders o
        LEFT JOIN vendor_commission_settings vcs ON o.vendor_id = vcs.vendor_id
        WHERE o.vendor_id = $1
        ${dateWhere ? `AND ${dateWhere}` : ""}
        AND o.status != 'cancelled'
      `;

      const result = await this.pool.query(query, [vendorId]);
      const earnings = result.rows[0];

      const response = {
        vendorId,
        orderCount: parseInt(earnings.order_count) || 0,
        totalSales: parseFloat(earnings.total_sales) || 0,
        totalEarnings: parseFloat(earnings.total_earnings) || 0,
        averageOrderValue: parseFloat(earnings.avg_order_value) || 0,
        periodStart: earnings.period_start,
        periodEnd: earnings.period_end,
      };

      // Cache for 1 hour
      await this.redisClient.setEx(cacheKey, 3600, JSON.stringify(response));

      return response;
    } catch (error) {
      logger.error("Failed to get vendor earnings", { vendorId, error });
      throw error;
    }
  }

  /**
   * Request payout for vendor
   */
  async requestPayout(vendorId, amount, bankAccountId) {
    try {
      if (amount <= 0) {
        throw new Error("Payout amount must be greater than zero");
      }

      // Check vendor balance
      const earnings = await this.getVendorEarnings(vendorId);
      if (amount > earnings.totalEarnings) {
        throw new Error("Insufficient funds for payout");
      }

      // Create payout record
      const query = `
        INSERT INTO vendor_payouts (vendor_id, amount, bank_account_id, status, requested_at)
        VALUES ($1, $2, $3, 'pending', NOW())
        RETURNING id, status, requested_at
      `;

      const result = await this.pool.query(query, [vendorId, amount, bankAccountId]);
      const payout = result.rows[0];

      logger.info("Payout requested", { vendorId, payoutId: payout.id, amount });

      return {
        payoutId: payout.id,
        vendorId,
        amount,
        status: payout.status,
        requestedAt: payout.requested_at,
      };
    } catch (error) {
      logger.error("Failed to request payout", { vendorId, error });
      throw error;
    }
  }

  /**
   * Process pending payouts (admin/automated)
   */
  async processPendingPayouts() {
    try {
      const query = `
        SELECT id, vendor_id, amount, bank_account_id
        FROM vendor_payouts
        WHERE status = 'pending'
        AND requested_at < NOW() - INTERVAL '1 day'
        LIMIT 100
      `;

      const result = await this.pool.query(query);
      const payouts = result.rows;

      const processed = [];
      for (const payout of payouts) {
        try {
          await this._processSinglePayout(payout);
          processed.push(payout.id);
        } catch (error) {
          logger.error("Failed to process payout", {
            payoutId: payout.id,
            error,
          });
        }
      }

      logger.info("Payouts processed", { count: processed.length });
      return processed;
    } catch (error) {
      logger.error("Failed to process pending payouts", { error });
      throw error;
    }
  }

  /**
   * Get vendor payouts history
   */
  async getPayoutHistory(vendorId, { page = 1, limit = 20 } = {}) {
    try {
      const offset = (page - 1) * limit;

      const query = `
        SELECT id, amount, status, requested_at, processed_at, reference_number
        FROM vendor_payouts
        WHERE vendor_id = $1
        ORDER BY requested_at DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM vendor_payouts
        WHERE vendor_id = $1
      `;

      const [payoutsResult, countResult] = await Promise.all([
        this.pool.query(query, [vendorId, limit, offset]),
        this.pool.query(countQuery, [vendorId]),
      ]);

      return {
        data: payoutsResult.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get payout history", { vendorId, error });
      throw error;
    }
  }

  // Private helper methods
  async _getVendorCommissionRate(vendorId) {
    const cacheKey = `vendor:commission:${vendorId}`;
    const cached = await this.redisClient.get(cacheKey);
    if (cached) {
      return parseFloat(cached);
    }

    const query = `
      SELECT commission_rate
      FROM vendor_commission_settings
      WHERE vendor_id = $1
      ORDER BY effective_from DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [vendorId]);
    const rate = result.rows[0]?.commission_rate || 15; // Default 15%

    await this.redisClient.setEx(cacheKey, 86400, rate.toString());
    return rate;
  }

  _calculateTax(amount) {
    // Simplified tax calculation (in production, use location-based tax)
    const TAX_RATE = 0.1; // 10%
    return amount * TAX_RATE;
  }

  _buildDateWhere(startDate, endDate) {
    if (!startDate && !endDate) return null;
    if (startDate && endDate) {
      return `o.created_at >= '${startDate}' AND o.created_at <= '${endDate}'`;
    }
    if (startDate) {
      return `o.created_at >= '${startDate}'`;
    }
    return `o.created_at <= '${endDate}'`;
  }

  async _processSinglePayout(payout) {
    // In production, integrate with Stripe, ACH, or other payment processor
    const updateQuery = `
      UPDATE vendor_payouts
      SET status = 'processed', processed_at = NOW(), reference_number = $1
      WHERE id = $2
    `;

    const referenceNumber = `PAYOUT-${Date.now()}-${payout.id}`;
    await this.pool.query(updateQuery, [referenceNumber, payout.id]);

    logger.info("Payout processed", {
      payoutId: payout.id,
      referenceNumber,
    });
  }
}

module.exports = CommissionService;
