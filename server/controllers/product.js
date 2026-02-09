const { pool } = require("../config/db");
const { successResponse, errorResponse } = require("../utils/response");
const {
  buildOrderByClause,
  buildPaginationParams,
} = require("../utils/queryBuilder");

exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      sort = "id",
      order = "asc",
      category,
    } = req.query;

    // Build safe ORDER BY clause
    let orderByClause;
    try {
      orderByClause = buildOrderByClause("products", sort, order);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    // Build pagination
    const { limit, offset } = buildPaginationParams(page, pageSize);

    // Build WHERE clause
    const whereClauses = ["is_active = true", "deleted_at IS NULL"];
    const params = [];
    let paramIndex = 1;

    if (category) {
      whereClauses.push(`category_id = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    const whereClause = whereClauses.join(" AND ");

    // Execute query - NO string concatenation of user input
    const query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.base_price,
        p.category_id,
        p.created_at,
        p.updated_at,
        c.name as category_name,
        COUNT(*) OVER() as total_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    const totalCount =
      result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Remove total_count from results
    const products = result.rows.map(({ total_count, ...product }) => product);

    return successResponse(
      res,
      products,
      "Products retrieved successfully",
      200,
      {
        page: parseInt(page),
        pageSize: limit,
        totalCount,
        totalPages,
      },
    );
  } catch (error) {
    console.error("Get products error:", error);
    return errorResponse(res, "Failed to fetch products", 500);
  }
};
