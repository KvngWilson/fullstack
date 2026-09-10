const { pool } = require("../config/db");

const ALLOWED_ROLES = new Set(["customer", "admin", "vendor"]);
const ALLOWED_ORDER_STATUSES = new Set([
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

const parsePagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Math.max(
    1,
    Math.min(100, Number.parseInt(query.pageSize ?? "20", 10) || 20),
  );
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
};

/**
 * Admin Dashboard Service.
 * Aggregates overview stats, user management, and order analytics.
 */
class AdminDashboardService {
  async getOverview() {
    const [totalsResult, orderStatusResult, recentOrdersResult, recentUsersResult] =
      await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM users) AS total_users,
            (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) AS active_products,
            (SELECT COUNT(*) FROM orders) AS total_orders,
            (SELECT COALESCE(SUM(total_cents), 0) / 100.0 FROM orders WHERE status = 'paid') AS total_revenue
        `),
        pool.query(`
          SELECT status, COUNT(*)::int AS count
          FROM orders
          GROUP BY status
          ORDER BY count DESC
        `),
        pool.query(
          `
            SELECT
              o.id,
              o.status,
              COALESCE(o.total_cents, 0) / 100.0 AS total_amount,
              o.created_at,
              u.email AS user_email
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            ORDER BY o.created_at DESC
            LIMIT 8
          `,
        ),
        pool.query(
          `
            SELECT
              id,
              email,
              role,
              created_at,
              last_login
            FROM users
            ORDER BY created_at DESC
            LIMIT 8
          `,
        ),
      ]);

    return {
      totals: totalsResult.rows[0] || {
        total_users: 0,
        active_products: 0,
        total_orders: 0,
        total_revenue: 0,
      },
      orderStatusBreakdown: orderStatusResult.rows || [],
      recentOrders: recentOrdersResult.rows || [],
      recentUsers: recentUsersResult.rows || [],
    };
  }

  async getUsers(query = {}) {
    const { page, pageSize, offset } = parsePagination(query);

    const [countResult, usersResult, summaryResult] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM users"),
      pool.query(
        `
          SELECT
            id,
            email,
            role,
            created_at,
            last_login
          FROM users
          ORDER BY created_at DESC
          LIMIT $1 OFFSET $2
        `,
        [pageSize, offset],
      ),
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE last_login IS NOT NULL
              AND last_login >= NOW() - INTERVAL '7 days'
          )::int AS active,
          COUNT(*) FILTER (
            WHERE created_at >= NOW() - INTERVAL '30 days'
          )::int AS new_last_30,
          COUNT(*) FILTER (WHERE role = 'admin')::int AS admins
        FROM users
      `),
    ]);
    const total = Number.parseInt(countResult.rows[0]?.count ?? "0", 10);

    return {
      data: usersResult.rows || [],
      summary: summaryResult.rows[0] || {
        total: 0,
        active: 0,
        new_last_30: 0,
        admins: 0,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasPrevious: page > 1,
        hasNext: offset + pageSize < total,
      },
    };
  }

  async getOrders(query = {}) {
    const { page, pageSize, offset } = parsePagination(query);
    const status = typeof query.status === "string" ? query.status.trim() : "";

    let countQuery = "SELECT COUNT(*) as count FROM orders";
    const countParams = [];

    if (status) {
      countQuery += " WHERE status = $1";
      countParams.push(status);
    }

    const summaryResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
        COUNT(*) FILTER (WHERE status = 'shipped')::int AS shipped,
        COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded,
        COUNT(*) FILTER (
          WHERE status IN ('shipped', 'delivered')
        )::int AS shippable_total,
        COUNT(*) FILTER (
          WHERE status IN ('shipped', 'delivered')
            AND tracking_number IS NOT NULL
            AND tracking_number <> ''
        )::int AS tracked_shipments,
        COUNT(*) FILTER (
          WHERE status = 'shipped'
            AND estimated_delivery_date IS NOT NULL
            AND estimated_delivery_date < CURRENT_DATE
        )::int AS overdue_shipments,
        COUNT(*) FILTER (
          WHERE status IN ('shipped', 'delivered')
            AND updated_at >= NOW() - INTERVAL '24 hours'
        )::int AS dispatched_last_24h,
        COALESCE(SUM(total_cents), 0) / 100.0 AS total_revenue
      FROM orders
    `);
    const countResult = await pool.query(countQuery, countParams);
    const total = Number.parseInt(countResult.rows[0]?.count ?? "0", 10);

    let ordersQuery = `
      SELECT
        o.id,
        o.user_id,
        o.status,
        o.payment_status,
        o.fulfillment_status,
        COALESCE(o.total_cents, 0) / 100.0 AS total_amount,
        o.created_at,
        o.updated_at,
        o.shipping_carrier,
        o.shipping_service,
        o.tracking_number,
        o.estimated_delivery_date,
        o.shipping_country,
        u.email AS user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
    `;

    const dataParams = [];
    if (status) {
      ordersQuery += " WHERE o.status = $1";
      dataParams.push(status);
    }

    ordersQuery +=
      " ORDER BY o.created_at DESC LIMIT $" +
      (dataParams.length + 1) +
      " OFFSET $" +
      (dataParams.length + 2);
    dataParams.push(pageSize, offset);

    const ordersResult = await pool.query(ordersQuery, dataParams);

    return {
      data: ordersResult.rows || [],
      filter: { status },
      summary: summaryResult.rows[0] || {
        total: 0,
        pending: 0,
        paid: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        refunded: 0,
        shippable_total: 0,
        tracked_shipments: 0,
        overdue_shipments: 0,
        dispatched_last_24h: 0,
        total_revenue: 0,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasPrevious: page > 1,
        hasNext: offset + pageSize < total,
      },
    };
  }

  async updateUserRole(userId, role) {
    const parsedUserId = Number.parseInt(userId, 10);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      throw new Error("Invalid user id");
    }

    if (!role || !ALLOWED_ROLES.has(role)) {
      throw new Error("Invalid role");
    }

    const result = await pool.query(
      `
        UPDATE users
        SET role = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, role
      `,
      [role, parsedUserId],
    );

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  }

  async deleteUser(userId, currentAdminId) {
    const parsedUserId = Number.parseInt(userId, 10);
    const parsedAdminId = Number.parseInt(currentAdminId, 10);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      throw new Error("Invalid user id");
    }

    if (Number.isInteger(parsedAdminId) && parsedUserId === parsedAdminId) {
      throw new Error("Cannot delete your own account");
    }

    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id, email",
      [parsedUserId],
    );

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  }

  async updateOrderStatus(orderId, status) {
    const parsedOrderId = Number.parseInt(orderId, 10);
    if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
      throw new Error("Invalid order id");
    }

    if (!status || !ALLOWED_ORDER_STATUSES.has(status)) {
      throw new Error("Invalid status");
    }

    const result = await pool.query(
      `
        UPDATE orders
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, status
      `,
      [status, parsedOrderId],
    );

    if (result.rows.length === 0) {
      throw new Error("Order not found");
    }

    return result.rows[0];
  }
}

module.exports = new AdminDashboardService();