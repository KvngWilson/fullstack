const BaseRepository = require("../../shared/repositories/BaseRepository");
const { pool } = require("../../../config/db");
const {
  buildOrderByClause,
  buildPaginationParams,
} = require("../../../shared/utils/queryBuilder");

/**
 * Product Repository.
 * Handles product persistence, filtering, and pagination queries.
 * Fixed to use actual database columns
 */
class ProductRepository extends BaseRepository {
  async findById(id) {
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.slug, p.vendor_id, p.category_id,
              NULL::text AS image_url,
              (MIN(pv.price_minor_units) / 100.0)::numeric(12,2) AS min_price,
              (MAX(pv.price_minor_units) / 100.0)::numeric(12,2) AS max_price,
              p.created_at, p.updated_at, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN product_variants pv ON p.id = pv.product_id
       WHERE p.id = $1 AND p.deleted_at IS NULL
       GROUP BY p.id, p.name, p.description, p.slug, p.vendor_id, p.category_id, c.name, p.created_at, p.updated_at`,
      [id],
    );
    return result.rows[0] || null;
  }

  async findAll(options = {}) {
    const {
      page = 1,
      pageSize = 20,
      sort = "id",
      order = "asc",
      category,
    } = options;

    const orderByClause = buildOrderByClause("products", sort, order);
    const { limit, offset } = buildPaginationParams(page, pageSize);

    const whereClauses = ["p.deleted_at IS NULL"];
    const params = [];
    let paramIndex = 1;

    if (category) {
      const categoryText = String(category).trim();
      const categoryId = Number.parseInt(categoryText, 10);

      if (Number.isInteger(categoryId) && String(categoryId) === categoryText) {
        whereClauses.push(`p.category_id = $${paramIndex}`);
        params.push(categoryId);
      } else {
        whereClauses.push(`LOWER(c.slug) = LOWER($${paramIndex})`);
        params.push(categoryText);
      }

      paramIndex++;
    }

    const query = `
      SELECT DISTINCT
        p.id,
        p.name,
        p.description,
        p.slug,
        p.vendor_id,
        p.category_id,
        NULL::text AS image_url,
        (MIN(pv.price_minor_units) OVER (PARTITION BY p.id) / 100.0)::numeric(12,2) AS min_price,
        (MAX(pv.price_minor_units) OVER (PARTITION BY p.id) / 100.0)::numeric(12,2) AS max_price,
        p.created_at,
        p.updated_at,
        c.name AS category_name,
        COUNT(*) OVER() AS total_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      WHERE ${whereClauses.join(" AND ")}
      ${orderByClause.replace("ORDER BY ", "ORDER BY p.")}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const products = result.rows.map(({ total_count, ...product }) => product);

    return {
      products,
      pagination: {
        page: parseInt(page, 10),
        pageSize: limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: parseInt(page, 10) * limit < totalCount,
        hasPrev: parseInt(page, 10) > 1,
      },
    };
  }

  async save(product) {
    if (product.id) {
      return this.update(product.id, product);
    }
    return this.create(product);
  }

  async create(data) {
    const result = await pool.query(
      `INSERT INTO products (vendor_id, category_id, name, slug, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, vendor_id, name, slug, description, category_id,
                 NULL::text AS image_url, created_at, updated_at`,
      [
        data.vendor_id,
        data.category_id ?? null,
        data.name,
        data.slug,
        data.description ?? null,
      ],
    );
    return result.rows[0] || null;
  }

  async update(id, data) {
    const updates = [];
    const params = [];
    let index = 1;

    const mutableFields = ["name", "slug", "description", "category_id"];

    for (const field of mutableFields) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updates.push(`${field} = $${index}`);
        params.push(data[field]);
        index++;
      }
    }

    if (updates.length === 0) return null;

    updates.push("updated_at = NOW()");
    params.push(id);

    const result = await pool.query(
      `UPDATE products
       SET ${updates.join(", ")}
       WHERE id = $${index} AND deleted_at IS NULL
       RETURNING id, vendor_id, name, slug, description, category_id,
                 NULL::text AS image_url, created_at, updated_at`,
      params,
    );

    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await pool.query(
      `UPDATE products
       SET deleted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id],
    );

    return result.rows[0] || null;
  }

  async findBySpec(spec) {
    return this.findAll(spec);
  }

  async count(spec = {}) {
    const whereClauses = ["deleted_at IS NULL"];
    const params = [];

    if (spec.category) {
      whereClauses.push(`category_id = $${params.length + 1}`);
      params.push(spec.category);
    }

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM products WHERE ${whereClauses.join(" AND ")}`,
      params,
    );
    return result.rows[0]?.count || 0;
  }

  async exists(id) {
    const result = await pool.query(
      "SELECT 1 FROM products WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
      [id],
    );
    return result.rowCount > 0;
  }

  async findFeatured(limit = 10) {
    const result = await pool.query(
      `SELECT DISTINCT p.id, p.name, p.description, p.slug, p.vendor_id, p.category_id,
              NULL::text AS image_url,
              (MIN(pv.price_minor_units) OVER (PARTITION BY p.id) / 100.0)::numeric(12,2) AS min_price,
              (MAX(pv.price_minor_units) OVER (PARTITION BY p.id) / 100.0)::numeric(12,2) AS max_price,
              p.created_at, p.updated_at, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN product_variants pv ON p.id = pv.product_id
       WHERE p.deleted_at IS NULL
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  }

  async findByIdWithVariants(productId) {
    const productResult = await pool.query(
      `SELECT p.id, p.name, p.description, p.slug, p.vendor_id, p.category_id,
              NULL::text AS image_url,
              p.created_at, p.updated_at, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [productId],
    );

    if (productResult.rows.length === 0) {
      return null;
    }

    const product = productResult.rows[0];

    const variantsResult = await pool.query(
      `SELECT v.id,
              v.sku,
              (v.price_minor_units / 100.0)::numeric(12,2) AS price,
              v.price_minor_units,
              v.stock,
              v.attributes
       FROM product_variants v
       WHERE v.product_id = $1`,
      [productId],
    );

    product.variants = variantsResult.rows;
    return product;
  }
}

module.exports = new ProductRepository();
