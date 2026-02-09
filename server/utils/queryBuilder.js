/**
 * Safe SQL query builder utilities
 * Prevents SQL injection through whitelist validation
 */

const SORT_COLUMNS = {
  products: {
    id: "id",
    name: "name",
    price: "base_price",
    created: "created_at",
    updated: "updated_at",
  },
  orders: {
    id: "id",
    date: "created_at",
    total: "total_amount",
    status: "status",
  },
  users: {
    id: "id",
    email: "email",
    name: "first_name",
    created: "created_at",
  },
};

const SORT_ORDERS = {
  asc: "ASC",
  desc: "DESC",
};

/**
 * Safely builds ORDER BY clause
 * @param {string} table - Table name (must be in SORT_COLUMNS)
 * @param {string} sort - Sort column key
 * @param {string} order - Sort order (asc/desc)
 * @returns {string} Safe ORDER BY clause
 * @throws {Error} If invalid table/column/order
 */
function buildOrderByClause(table, sort = "id", order = "asc") {
  if (!SORT_COLUMNS[table]) {
    throw new Error(`Invalid table for sorting: ${table}`);
  }

  const sortColumn = SORT_COLUMNS[table][sort];
  if (!sortColumn) {
    throw new Error(`Invalid sort column '${sort}' for table '${table}'`);
  }

  const sortOrder = SORT_ORDERS[order.toLowerCase()];
  if (!sortOrder) {
    throw new Error(`Invalid sort order: ${order}. Use 'asc' or 'desc'`);
  }

  return `ORDER BY ${sortColumn} ${sortOrder}`;
}

/**
 * Builds pagination clause
 * @param {number} page - Page number (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {{limit: number, offset: number}}
 */
function buildPaginationParams(page = 1, pageSize = 20) {
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedPageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 20));

  return {
    limit: parsedPageSize,
    offset: (parsedPage - 1) * parsedPageSize,
  };
}

/**
 * Safely builds WHERE clause from filters
 * @param {Object} filters - Key-value filter pairs
 * @param {Object} allowedColumns - Whitelist of allowed columns
 * @returns {{clause: string, params: Array}}
 */
function buildWhereClause(filters, allowedColumns) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(filters)) {
    if (!allowedColumns[key]) {
      throw new Error(`Invalid filter column: ${key}`);
    }

    if (value !== null && value !== undefined) {
      conditions.push(`${allowedColumns[key]} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  const clause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return { clause, params };
}

module.exports = {
  buildOrderByClause,
  buildPaginationParams,
  buildWhereClause,
  SORT_COLUMNS,
  SORT_ORDERS,
};
