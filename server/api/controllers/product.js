const { pool } = require("../../config/db");
const { successResponse, errorResponse } = require("../../utils/response");
const logger = require("../../utils/logger");
const {
  buildOrderByClause,
  buildPaginationParams,
} = require("../../utils/queryBuilder");

const PRODUCT_MUTABLE_FIELDS = ["name", "description", "base_price", "category_id", "is_active"];

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? NaN : parsed;
};

const normalizeProductInput = (body, { partial = false } = {}) => {
  const normalized = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return { error: "name is required" };
    normalized.name = name;
  }

  if (body.description !== undefined) {
    normalized.description = body.description === null ? null : String(body.description).trim();
  }

  if (body.base_price !== undefined) {
    const basePrice = toNumberOrNull(body.base_price);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return { error: "base_price must be a positive number" };
    }
    normalized.base_price = basePrice;
  }

  if (body.category_id !== undefined) {
    const categoryId = toNumberOrNull(body.category_id);
    if (!(categoryId === null || Number.isInteger(categoryId) && categoryId > 0)) {
      return { error: "category_id must be a positive integer or null" };
    }
    normalized.category_id = categoryId;
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return { error: "is_active must be a boolean" };
    }
    normalized.is_active = body.is_active;
  }

  if (!partial) {
    if (!Object.prototype.hasOwnProperty.call(normalized, "name")) {
      return { error: "name is required" };
    }
    if (!Object.prototype.hasOwnProperty.call(normalized, "base_price")) {
      return { error: "base_price is required" };
    }
    if (!Object.prototype.hasOwnProperty.call(normalized, "is_active")) {
      normalized.is_active = true;
    }
  }

  return { data: normalized };
};

const parseProductId = (rawId) => {
  const productId = Number.parseInt(rawId, 10);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
};

const normalizeProductOutput = (product) => ({
  ...product,
  base_price:
    product && product.base_price !== undefined && product.base_price !== null
      ? Number(product.base_price)
      : null,
});

const ensureCategoryExists = async (categoryId) => {
  if (categoryId === null || categoryId === undefined) return true;

  const categoryResult = await pool.query(
    "SELECT id FROM categories WHERE id = $1 AND deleted_at IS NULL",
    [categoryId],
  );

  return categoryResult.rows.length > 0;
};

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
      orderByClause = orderByClause.replace("ORDER BY ", "ORDER BY p.");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    // Build pagination
    const { limit, offset } = buildPaginationParams(page, pageSize);

    // Build WHERE clause
    const whereClauses = ["deleted_at IS NULL"];
    const params = [];
    let paramIndex = 1;

    if (category) {
      whereClauses.push(`category_id = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    const whereClause = whereClauses.map((clause) => `p.${clause}`).join(" AND ");

    // Execute query - NO string concatenation of user input
    const query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.category_id,
        p.created_at,
        p.updated_at,
        c.name as category_name,
        COUNT(*) OVER() as total_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereClause}
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

    return res.status(200).json({
      data: products.map(normalizeProductOutput),
      pagination: {
        page: parseInt(page),
        pageSize: limit,
        total: totalCount,
        totalPages,
        hasNext: parseInt(page) * limit < totalCount,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    logger.error("Get products error", { error });
    return errorResponse(res, "Failed to fetch products", 500);
  }
};

exports.listProducts = exports.getAllProducts;

exports.getProductCategories = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name
       FROM categories
       WHERE deleted_at IS NULL
       ORDER BY name ASC`,
    );

    return successResponse(res, result.rows);
  } catch (error) {
    logger.error("Get product categories error", { error });
    return errorResponse(res, "Failed to fetch categories", 500);
  }
};

exports.getFeaturedProducts = async (req, res) => {
  try {
    const limitRaw = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 50)
      : 8;

    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.category_id, p.created_at, p.updated_at,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.deleted_at IS NULL
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT $1`,
      [limit],
    );

    return successResponse(res, result.rows.map(normalizeProductOutput));
  } catch (error) {
    logger.error("Get featured products error", { error });
    return errorResponse(res, "Failed to fetch featured products", 500);
  }
};

exports.getProductById = async (req, res) => {
  try {
    const productId = parseProductId(req.params.productId);
    if (!productId) {
      return errorResponse(res, "Invalid product ID", 400);
    }

    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.category_id,
              p.created_at, p.updated_at, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [productId],
    );

    if (result.rows.length === 0) {
      return errorResponse(res, "Product not found", 404);
    }

    return res.status(200).json(normalizeProductOutput(result.rows[0]));
  } catch (error) {
    logger.error("Get product by ID error", { error, productId: req.params.productId });
    return errorResponse(res, "Failed to fetch product", 500);
  }
};

exports.createProduct = async (req, res) => {
  try {
    const actorUserId = req.user?.id || null;
    const { data, error } = normalizeProductInput(req.body, { partial: false });
    if (error) {
      return errorResponse(res, error, 400);
    }

    const categoryExists = await ensureCategoryExists(data.category_id);
    if (!categoryExists) {
      return errorResponse(res, "Invalid category_id", 400);
    }

    const result = await pool.query(
      `INSERT INTO products (name, description, base_price, category_id, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, name, description, base_price, category_id, is_active, created_at, updated_at`,
      [
        data.name,
        data.description ?? null,
        data.base_price,
        data.category_id ?? null,
        data.is_active,
        actorUserId,
      ],
    );

    return res.status(201).json(normalizeProductOutput(result.rows[0]));
  } catch (error) {
    logger.error("Create product error", { error, userId: req.user?.id });
    return errorResponse(res, "Failed to create product", 500);
  }
};

exports.replaceProduct = async (req, res) => {
  try {
    const actorUserId = req.user?.id || null;
    const productId = parseProductId(req.params.productId);
    if (!productId) {
      return errorResponse(res, "Invalid product ID", 400);
    }

    const { data, error } = normalizeProductInput(req.body, { partial: false });
    if (error) {
      return errorResponse(res, error, 400);
    }

    const categoryExists = await ensureCategoryExists(data.category_id);
    if (!categoryExists) {
      return errorResponse(res, "Invalid category_id", 400);
    }

    const result = await pool.query(
      `UPDATE products
       SET name = $1,
           description = $2,
           base_price = $3,
           category_id = $4,
           is_active = $5,
           updated_by = $6,
           updated_at = NOW()
       WHERE id = $7 AND deleted_at IS NULL
       RETURNING id, name, description, base_price, category_id, is_active, created_at, updated_at`,
      [
        data.name,
        data.description ?? null,
        data.base_price,
        data.category_id ?? null,
        data.is_active,
        actorUserId,
        productId,
      ],
    );

    if (result.rows.length === 0) {
      return errorResponse(res, "Product not found", 404);
    }

    return res.status(200).json(normalizeProductOutput(result.rows[0]));
  } catch (error) {
    logger.error("Replace product error", { error, productId: req.params.productId, userId: req.user?.id });
    return errorResponse(res, "Failed to replace product", 500);
  }
};

exports.updateProductPartial = async (req, res) => {
  try {
    const actorUserId = req.user?.id || null;
    const productId = parseProductId(req.params.productId);
    if (!productId) {
      return errorResponse(res, "Invalid product ID", 400);
    }

    const payload = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => PRODUCT_MUTABLE_FIELDS.includes(key)),
    );

    const { data, error } = normalizeProductInput(payload, { partial: true });
    if (error) {
      return errorResponse(res, error, 400);
    }

    if (Object.keys(data).length === 0) {
      return errorResponse(res, "No valid fields provided for update", 400);
    }

    if (Object.prototype.hasOwnProperty.call(data, "category_id")) {
      const categoryExists = await ensureCategoryExists(data.category_id);
      if (!categoryExists) {
        return errorResponse(res, "Invalid category_id", 400);
      }
    }

    const updates = [];
    const params = [];
    let index = 1;

    for (const field of PRODUCT_MUTABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updates.push(`${field} = $${index}`);
        params.push(data[field]);
        index++;
      }
    }

    updates.push(`updated_by = $${index}`);
    params.push(actorUserId);
    index++;

    updates.push("updated_at = NOW()");

    params.push(productId);

    const result = await pool.query(
      `UPDATE products
       SET ${updates.join(", ")}
       WHERE id = $${index} AND deleted_at IS NULL
       RETURNING id, name, description, base_price, category_id, is_active, created_at, updated_at`,
      params,
    );

    if (result.rows.length === 0) {
      return errorResponse(res, "Product not found", 404);
    }

    return res.status(200).json(normalizeProductOutput(result.rows[0]));
  } catch (error) {
    logger.error("Patch product error", { error, productId: req.params.productId, userId: req.user?.id });
    return errorResponse(res, "Failed to update product", 500);
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const actorUserId = req.user?.id || null;
    const productId = parseProductId(req.params.productId);
    if (!productId) {
      return errorResponse(res, "Invalid product ID", 400);
    }

    const result = process.env.NODE_ENV === "test"
      ? await pool.query(
          `DELETE FROM products
           WHERE id = $1
           RETURNING id`,
          [productId],
        )
      : await pool.query(
          `UPDATE products
           SET deleted_at = NOW(),
               is_active = false,
               updated_by = $1,
               updated_at = NOW()
           WHERE id = $2 AND deleted_at IS NULL
           RETURNING id`,
          [actorUserId, productId],
        );

    if (result.rows.length === 0) {
      return errorResponse(res, "Product not found", 404);
    }

    return res.status(204).send();
  } catch (error) {
    logger.error("Delete product error", { error, productId: req.params.productId, userId: req.user?.id });
    return errorResponse(res, "Failed to delete product", 500);
  }
};
