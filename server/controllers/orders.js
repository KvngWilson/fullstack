const { pool } = require("../config/db");
const { successResponse, errorResponse } = require("../utils/response");

exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    // Build query with authorization check
    let query = `
      SELECT
        o.id,
        o.user_id,
        o.status,
        o.net_amount,
        o.tax,
        o.shipping_cost,
        o.total_amount,
        o.shipping_address_id,
        o.billing_address_id,
        o.created_at,
        o.updated_at,
        u.email as user_email,
        u.first_name,
        u.last_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = $1
    `;

    const params = [orderId];

    // Non-admins can only see their own orders
    if (!isAdmin) {
      query += " AND o.user_id = $2";
      params.push(userId);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return errorResponse(res, "Order not found", 404);
    }

    const order = result.rows[0];

    // Fetch order items
    const itemsResult = await pool.query(
      `
      SELECT
        oi.id as order_item_id,
        oi.variant_id,
        oi.quantity,
        oi.price,
        v.sku,
        v.size,
        v.color,
        p.id as product_id,
        p.name as product_name,
        p.description as product_description
      FROM order_items oi
      JOIN variants v ON oi.variant_id = v.id
      JOIN products p ON v.product_id = p.id
      WHERE oi.order_id = $1
      `,
      [orderId],
    );

    order.items = itemsResult.rows;

    return successResponse(res, order, "Order retrieved successfully");
  } catch (error) {
    console.error("Get order error:", error);
    return errorResponse(res, "Failed to fetch order", 500);
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";
    const { status, page = 1, pageSize = 20 } = req.query;

    const limit = Math.min(100, parseInt(pageSize) || 20);
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    // Build WHERE clause
    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    // Non-admins only see their orders
    if (!isAdmin) {
      whereClauses.push(`o.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (status) {
      whereClauses.push(`o.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      SELECT
        o.id,
        o.user_id,
        o.status,
        o.total_amount,
        o.created_at,
        u.email,
        u.first_name,
        u.last_name,
        COUNT(*) OVER() as total_count
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    const totalCount =
      result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const totalPages = Math.ceil(totalCount / limit);

    const orders = result.rows.map(({ total_count, ...order }) => order);

    return successResponse(res, orders, "Orders retrieved successfully", 200, {
      page: parseInt(page),
      pageSize: limit,
      totalCount,
      totalPages,
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    return errorResponse(res, "Failed to fetch orders", 500);
  }
};
