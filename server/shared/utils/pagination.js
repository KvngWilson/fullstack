/**
 * Cursor-based pagination utilities
 * Provides efficient pagination without offset issues
 */

/**
 * Encode cursor value to base64
 * @param {*} value - Value to encode
 * @returns {string} - Base64-encoded cursor
 */
function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

/**
 * Decode cursor value from base64
 * @param {string} cursor - Base64-encoded cursor
 * @returns {*} - Decoded value
 */
function decodeCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

/**
 * Build cursor-based pagination query
 * @param {string} baseQuery - Base SQL query
 * @param {*} cursor - Previous cursor value
 * @param {string} orderBy - Column to order by (default 'id')
 * @param {string} direction - 'ASC' or 'DESC' (default 'ASC')
 * @param {number} limit - Items per page
 * @returns {object} - { query, params }
 */
function buildPaginationQuery(
  baseQuery,
  cursor = null,
  orderBy = 'id',
  direction = 'ASC',
  limit = 20
) {
  const params = [];
  let query = baseQuery;

  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    const operator = direction === 'DESC' ? '<' : '>';
    
    query += ` AND ${orderBy} ${operator} $${params.length + 1}`;
    params.push(decodedCursor);
  }

  query += ` ORDER BY ${orderBy} ${direction} LIMIT $${params.length + 1}`;
  params.push(limit + 1); // Fetch one extra to detect hasMore

  return { query, params };
}

/**
 * Process pagination results
 * @param {Array} rows - Database rows
 * @param {number} limit - Items per page
 * @param {string} cursorField - Field to use for cursor (default 'id')
 * @param {string} direction - 'ASC' or 'DESC'
 * @returns {object} - { items, nextCursor, hasPrevious, hasNext }
 */
function processPaginationResults(rows, limit, cursorField = 'id', direction = 'ASC') {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1][cursorField])
    : null;

  const prevCursor = items.length > 0 && direction === 'ASC'
    ? encodeCursor(items[0][cursorField])
    : null;

  return {
    items,
    nextCursor,
    prevCursor,
    hasMore,
    count: items.length
  };
}

/**
 * Complete pagination helper for repositories
 * Combines query building and result processing
 * 
 * @example
 * async function getProducts(filter, cursor) {
 *   const baseQuery = 'SELECT * FROM products WHERE deleted_at IS NULL';
 *   return paginate(pool, baseQuery, { cursor, limit: 20, orderBy: 'id' });
 * }
 */
async function paginate(
  pool,
  baseQuery,
  options = {}
) {
  const {
    cursor = null,
    limit = 20,
    orderBy = 'id',
    direction = 'ASC',
    cursorField = orderBy
  } = options;

  // Validate limit
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  // Build query
  const { query, params } = buildPaginationQuery(
    baseQuery,
    cursor,
    orderBy,
    direction,
    limit
  );

  // Execute query
  const result = await pool.query(query, params);

  // Process results
  return processPaginationResults(
    result.rows,
    limit,
    cursorField,
    direction
  );
}

/**
 * Pagination response formatter for APIs
 * @param {object} paginationResult - Result from paginate()
 * @param {string} dataField - Name of data field in response
 * @returns {object} - Formatted API response
 */
function formatPaginationResponse(paginationResult, dataField = 'items') {
  return {
    [dataField]: paginationResult.items,
    pagination: {
      count: paginationResult.count,
      hasMore: paginationResult.hasMore,
      nextCursor: paginationResult.nextCursor,
      prevCursor: paginationResult.prevCursor
    }
  };
}

/**
 * Middleware for parsing pagination parameters
 * Usage: app.use(paginationMiddleware())
 */
function paginationMiddleware() {
  return (req, res, next) => {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 20, 1),
      100
    );

    const cursor = req.query.cursor || null;
    const orderBy = req.query.orderBy || 'id';
    const direction = (req.query.direction || 'ASC').toUpperCase();

    if (!['ASC', 'DESC'].includes(direction)) {
      return res.status(400).json({ error: 'Invalid direction' });
    }

    req.pagination = {
      limit,
      cursor,
      orderBy,
      direction
    };

    next();
  };
}

module.exports = {
  encodeCursor,
  decodeCursor,
  buildPaginationQuery,
  processPaginationResults,
  paginate,
  formatPaginationResponse,
  paginationMiddleware
};
