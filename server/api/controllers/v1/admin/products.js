const { pool } = require("../../../../config/db");
const { successResponse, errorResponse } = require("../../../../shared/utils/response");

exports.listVendors = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.id, v.store_name, v.slug, v.status, u.email
       FROM vendors v
       JOIN users u ON u.id = v.user_id
       WHERE v.deleted_at IS NULL AND v.status = 'active'
       ORDER BY v.store_name ASC`,
    );

    return successResponse(res, {
      data: result.rows,
      message: "Vendors retrieved successfully",
    });
  } catch (error) {
    return errorResponse(res, {
      message: "Failed to fetch vendors",
      status: 500,
    });
  }
};
