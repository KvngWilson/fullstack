const BaseRepository = require("../../shared/repositories/BaseRepository");
const { pool } = require("../../../config/db");
const {
  buildOrderByClause,
  buildPaginationParams,
} = require("../../../shared/utils/queryBuilder");

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIntegerOrDefault(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }

  return fallback;
}

class ProductRepository extends BaseRepository {
  constructor() {
    super();
    this.tableColumnCache = new Map();
  }

  async getTableColumns(tableName) {
    if (this.tableColumnCache.has(tableName)) {
      return this.tableColumnCache.get(tableName);
    }

    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [tableName],
    );

    const columns = new Set(result.rows.map((row) => row.column_name));
    this.tableColumnCache.set(tableName, columns);
    return columns;
  }

  getProductBasePriceExpression(productColumns, alias = "p") {
    return productColumns.has("base_price")
      ? `COALESCE(${alias}.base_price, 0)`
      : "0";
  }

  getVariantPriceExpression(variantColumns, alias = "pv") {
    if (variantColumns.has("price_minor_units")) {
      return `(${alias}.price_minor_units / 100.0)::numeric(12,2)`;
    }

    if (variantColumns.has("price_cents")) {
      return `(${alias}.price_cents / 100.0)::numeric(12,2)`;
    }

    if (variantColumns.has("price")) {
      return `${alias}.price::numeric(12,2)`;
    }

    return null;
  }

  getVariantStockExpression(variantColumns, alias = "pv") {
    if (variantColumns.has("stock")) {
      return `${alias}.stock`;
    }

    if (variantColumns.has("stock_quantity")) {
      return `${alias}.stock_quantity`;
    }

    return "NULL::int";
  }

  getVariantSelectColumns(variantColumns, alias = "v") {
    const priceExpression = this.getVariantPriceExpression(variantColumns, alias);
    const stockExpression = this.getVariantStockExpression(variantColumns, alias);

    return [
      `${alias}.id`,
      variantColumns.has("sku") ? `${alias}.sku` : "NULL::text AS sku",
      priceExpression ? `${priceExpression} AS price` : "NULL::numeric(12,2) AS price",
      stockExpression !== "NULL::int" ? `${stockExpression} AS stock` : stockExpression,
      variantColumns.has("attributes")
        ? `${alias}.attributes`
        : "'{}'::jsonb AS attributes",
    ];
  }

  getProductSelectColumns(productColumns, variantColumns, alias = "p") {
    const basePriceExpression = this.getProductBasePriceExpression(
      productColumns,
      alias,
    );
    const variantPriceExpression = this.getVariantPriceExpression(
      variantColumns,
      "pv",
    );

    return [
      `${alias}.id`,
      `${alias}.name`,
      productColumns.has("description")
        ? `${alias}.description`
        : "NULL::text AS description",
      productColumns.has("slug") ? `${alias}.slug` : "NULL::text AS slug",
      productColumns.has("vendor_id")
        ? `${alias}.vendor_id`
        : "NULL::bigint AS vendor_id",
      productColumns.has("category_id")
        ? `${alias}.category_id`
        : "NULL::bigint AS category_id",
      productColumns.has("brand")
        ? `COALESCE(${alias}.brand, v.store_name) AS brand`
        : "COALESCE(v.store_name, '') AS brand",
      productColumns.has("material")
        ? `${alias}.material`
        : "NULL::text AS material",
      productColumns.has("care_instructions")
        ? `${alias}.care_instructions`
        : "NULL::text AS care_instructions",
      productColumns.has("image_url")
        ? `${alias}.image_url`
        : "NULL::text AS image_url",
      `${basePriceExpression}::numeric(12,2) AS base_price`,
      productColumns.has("is_active")
        ? `${alias}.is_active`
        : "true AS is_active",
      variantPriceExpression
        ? `COALESCE(MIN(${variantPriceExpression}), ${basePriceExpression})::numeric(12,2) AS min_price`
        : `${basePriceExpression}::numeric(12,2) AS min_price`,
      variantPriceExpression
        ? `COALESCE(MAX(${variantPriceExpression}), ${basePriceExpression})::numeric(12,2) AS max_price`
        : `${basePriceExpression}::numeric(12,2) AS max_price`,
      productColumns.has("created_at")
        ? `${alias}.created_at`
        : "NOW() AS created_at",
      productColumns.has("updated_at")
        ? `${alias}.updated_at`
        : "NOW() AS updated_at",
      "c.name AS category_name",
      "COALESCE(v.store_name, '') AS vendor_name",
    ];
  }

  async findById(id) {
    const productColumns = await this.getTableColumns("products");
    const variantColumns = await this.getTableColumns("product_variants");
    const selectColumns = this.getProductSelectColumns(productColumns, variantColumns);

    const result = await pool.query(
      `SELECT ${selectColumns.join(", ")}
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN vendors v ON p.vendor_id = v.id
       LEFT JOIN product_variants pv ON p.id = pv.product_id
       WHERE p.id = $1 AND p.deleted_at IS NULL
       GROUP BY p.id, c.name, v.store_name`,
      [id],
    );

    return result.rows[0] || null;
  }

  async findAll(options = {}) {
    const productColumns = await this.getTableColumns("products");
    const variantColumns = await this.getTableColumns("product_variants");
    const {
      page = 1,
      pageSize = 20,
      sort = "id",
      order = "asc",
      category,
      search,
    } = options;

    const orderByClause = buildOrderByClause("products", sort, order);
    const { limit, offset } = buildPaginationParams(page, pageSize);
    const selectColumns = this.getProductSelectColumns(productColumns, variantColumns);

    const whereClauses = ["p.deleted_at IS NULL"];
    const params = [];
    let paramIndex = 1;
    const searchText = typeof search === "string" ? search.trim() : "";
    const hasSearch = searchText.length > 0;
    let searchExactParamIndex = null;
    let searchContainsParamIndex = null;
    let searchPrefixParamIndex = null;
    let searchTsQueryParamIndex = null;

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

    if (hasSearch) {
      searchExactParamIndex = paramIndex;
      params.push(searchText);
      paramIndex++;

      searchContainsParamIndex = paramIndex;
      params.push(`%${searchText}%`);
      paramIndex++;

      searchPrefixParamIndex = paramIndex;
      params.push(`${searchText}%`);
      paramIndex++;

      searchTsQueryParamIndex = paramIndex;
      params.push(searchText);
      paramIndex++;

      whereClauses.push(`(
        p.name ILIKE $${searchContainsParamIndex}
        OR p.slug ILIKE $${searchContainsParamIndex}
        OR COALESCE(p.description, '') ILIKE $${searchContainsParamIndex}
        OR COALESCE(c.name, '') ILIKE $${searchContainsParamIndex}
        OR COALESCE(v.store_name, '') ILIKE $${searchContainsParamIndex}
        OR COALESCE(p.brand, '') ILIKE $${searchContainsParamIndex}
      )`);
    }

    const relevanceScoreSelect = hasSearch
      ? `
        (
          CASE
            WHEN LOWER(p.name) = LOWER($${searchExactParamIndex}) THEN 120
            WHEN LOWER(p.slug) = LOWER($${searchExactParamIndex}) THEN 115
            WHEN LOWER(p.name) LIKE LOWER($${searchPrefixParamIndex}) THEN 105
            WHEN LOWER(p.slug) LIKE LOWER($${searchPrefixParamIndex}) THEN 100
            WHEN p.name ILIKE $${searchContainsParamIndex} THEN 85
            WHEN COALESCE(c.name, '') ILIKE $${searchContainsParamIndex} THEN 70
            WHEN COALESCE(v.store_name, '') ILIKE $${searchContainsParamIndex} THEN 65
            WHEN COALESCE(p.brand, '') ILIKE $${searchContainsParamIndex} THEN 60
            WHEN COALESCE(p.description, '') ILIKE $${searchContainsParamIndex} THEN 45
            ELSE 0
          END
          +
          (
            ts_rank_cd(
              setweight(to_tsvector('simple', COALESCE(p.name, '')), 'A') ||
              setweight(to_tsvector('simple', COALESCE(p.slug, '')), 'A') ||
              setweight(to_tsvector('simple', COALESCE(c.name, '')), 'B') ||
              setweight(to_tsvector('simple', COALESCE(v.store_name, '')), 'C') ||
              setweight(to_tsvector('simple', COALESCE(p.description, '')), 'D'),
              plainto_tsquery('simple', $${searchTsQueryParamIndex})
            ) * 100.0
          )
        ) AS relevance_score`
      : "";

    const orderBySql = hasSearch
      ? "ORDER BY relevance_score DESC, p.updated_at DESC, p.id DESC"
      : orderByClause.replace("ORDER BY ", "ORDER BY p.");

    const query = `
      SELECT
        ${selectColumns.join(", ")},
        ${hasSearch ? `${relevanceScoreSelect},` : ""}
        COUNT(*) OVER() AS total_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY p.id, c.name, v.store_name
      ${orderBySql}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const totalCount =
      result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count, 10) : 0;
    const products = result.rows.map(({ total_count, relevance_score, ...product }) => product);

    return {
      products,
      pagination: {
        page: Number.parseInt(page, 10),
        pageSize: limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: Number.parseInt(page, 10) * limit < totalCount,
        hasPrev: Number.parseInt(page, 10) > 1,
      },
    };
  }

  async save(product) {
    if (product.id) {
      return this.update(product.id, product);
    }
    return this.create(product);
  }

  async buildSlug(client, sourceSlug, productId = null) {
    const baseSlug = slugify(sourceSlug) || `product-${Date.now()}`;
    let candidate = baseSlug;
    let suffix = 1;

    while (true) {
      const result = await client.query(
        `SELECT 1
         FROM products
         WHERE slug = $1 AND deleted_at IS NULL
           ${productId ? "AND id <> $2" : ""}
         LIMIT 1`,
        productId ? [candidate, productId] : [candidate],
      );

      if (result.rowCount === 0) {
        return candidate;
      }

      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }
  }

  async upsertPrimaryVariant(client, productId, productData, variantColumns, productSlug) {
    if (!variantColumns.size) {
      return;
    }

    const existingVariantResult = await client.query(
      `SELECT id, sku
       FROM product_variants
       WHERE product_id = $1 AND deleted_at IS NULL
       ORDER BY id ASC
       LIMIT 1`,
      [productId],
    );

    const existingVariant = existingVariantResult.rows[0] || null;
    const sku =
      String(productData.sku || "").trim() ||
      existingVariant?.sku ||
      `${String(productSlug || `product-${productId}`).toUpperCase()}-DEFAULT`;
    const basePrice = toNumberOrNull(productData.base_price);
    const stock = toIntegerOrDefault(productData.stock, 0);

    const assignments = [];
    const values = [];
    let paramIndex = 1;

    if (variantColumns.has("sku")) {
      assignments.push(`sku = $${paramIndex}`);
      values.push(sku);
      paramIndex++;
    }

    if (basePrice !== null) {
      if (variantColumns.has("price_minor_units")) {
        assignments.push(`price_minor_units = $${paramIndex}`);
        values.push(Math.round(basePrice * 100));
        paramIndex++;
      } else if (variantColumns.has("price_cents")) {
        assignments.push(`price_cents = $${paramIndex}`);
        values.push(Math.round(basePrice * 100));
        paramIndex++;
      } else if (variantColumns.has("price")) {
        assignments.push(`price = $${paramIndex}`);
        values.push(basePrice);
        paramIndex++;
      }
    }

    if (
      productData.stock !== undefined ||
      (!existingVariant && (variantColumns.has("stock") || variantColumns.has("stock_quantity")))
    ) {
      if (variantColumns.has("stock")) {
        assignments.push(`stock = $${paramIndex}`);
        values.push(stock);
        paramIndex++;
      } else if (variantColumns.has("stock_quantity")) {
        assignments.push(`stock_quantity = $${paramIndex}`);
        values.push(stock);
        paramIndex++;
      }
    }

    if (variantColumns.has("attributes") && !existingVariant) {
      assignments.push(`attributes = $${paramIndex}`);
      values.push(JSON.stringify({}));
      paramIndex++;
    }

    if (existingVariant) {
      if (!assignments.length) {
        return existingVariant;
      }

      values.push(existingVariant.id);
      await client.query(
        `UPDATE product_variants
         SET ${assignments.join(", ")}, updated_at = NOW()
         WHERE id = $${paramIndex}`,
        values,
      );

      return existingVariant;
    }

    const insertColumns = ["product_id"];
    const insertValues = ["$1"];
    const insertParams = [productId];
    let insertParamIndex = 2;

    if (variantColumns.has("sku")) {
      insertColumns.push("sku");
      insertValues.push(`$${insertParamIndex}`);
      insertParams.push(sku);
      insertParamIndex++;
    }

    if (variantColumns.has("price_minor_units")) {
      insertColumns.push("price_minor_units");
      insertValues.push(`$${insertParamIndex}`);
      insertParams.push(Math.round((basePrice || 0) * 100));
      insertParamIndex++;
    } else if (variantColumns.has("price_cents")) {
      insertColumns.push("price_cents");
      insertValues.push(`$${insertParamIndex}`);
      insertParams.push(Math.round((basePrice || 0) * 100));
      insertParamIndex++;
    } else if (variantColumns.has("price")) {
      insertColumns.push("price");
      insertValues.push(`$${insertParamIndex}`);
      insertParams.push(basePrice || 0);
      insertParamIndex++;
    }

    if (variantColumns.has("stock")) {
      insertColumns.push("stock");
      insertValues.push(`$${insertParamIndex}`);
      insertParams.push(stock);
      insertParamIndex++;
    } else if (variantColumns.has("stock_quantity")) {
      insertColumns.push("stock_quantity");
      insertValues.push(`$${insertParamIndex}`);
      insertParams.push(stock);
      insertParamIndex++;
    }

    if (variantColumns.has("attributes")) {
      insertColumns.push("attributes");
      insertValues.push(`$${insertParamIndex}`);
      insertParams.push(JSON.stringify({}));
    }

    await client.query(
      `INSERT INTO product_variants (${insertColumns.join(", ")})
       VALUES (${insertValues.join(", ")})`,
      insertParams,
    );

    return null;
  }

  async create(data) {
    const productColumns = await this.getTableColumns("products");
    const variantColumns = await this.getTableColumns("product_variants");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const name = String(data.name || "").trim();
      const slug = await this.buildSlug(client, data.slug || name);
      const columns = ["name", "slug"];
      const values = [name, slug];

      if (productColumns.has("vendor_id")) {
        const vendorId = toNumberOrNull(data.vendor_id);
        if (vendorId === null) {
          throw new Error("vendor_id is required");
        }
        columns.push("vendor_id");
        values.push(vendorId);
      }

      if (productColumns.has("category_id")) {
        columns.push("category_id");
        values.push(toNumberOrNull(data.category_id));
      }

      if (productColumns.has("description")) {
        columns.push("description");
        values.push(data.description || null);
      }

      if (productColumns.has("brand")) {
        columns.push("brand");
        values.push(data.brand || null);
      }

      if (productColumns.has("material")) {
        columns.push("material");
        values.push(data.material || null);
      }

      if (productColumns.has("care_instructions")) {
        columns.push("care_instructions");
        values.push(data.care_instructions || null);
      }

      if (productColumns.has("image_url")) {
        columns.push("image_url");
        values.push(data.image_url || null);
      }

      if (productColumns.has("base_price")) {
        columns.push("base_price");
        values.push(toNumberOrNull(data.base_price) || 0);
      }

      if (productColumns.has("is_active")) {
        columns.push("is_active");
        values.push(toBoolean(data.is_active, true));
      }

      if (productColumns.has("created_by")) {
        columns.push("created_by");
        values.push(toNumberOrNull(data.actorUserId));
      }

      if (productColumns.has("updated_by")) {
        columns.push("updated_by");
        values.push(toNumberOrNull(data.actorUserId));
      }

      const result = await client.query(
        `INSERT INTO products (${columns.join(", ")})
         VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")})
         RETURNING id`,
        values,
      );

      const productId = result.rows[0].id;
      await this.upsertPrimaryVariant(client, productId, data, variantColumns, slug);

      await client.query("COMMIT");
      return this.findByIdWithVariants(productId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id, data) {
    const productColumns = await this.getTableColumns("products");
    const variantColumns = await this.getTableColumns("product_variants");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingResult = await client.query(
        "SELECT id, name, slug FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
        [id],
      );

      if (existingResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      const existing = existingResult.rows[0];
      const updates = [];
      const params = [];
      let index = 1;

      if (Object.prototype.hasOwnProperty.call(data, "name")) {
        updates.push(`name = $${index}`);
        params.push(String(data.name || "").trim());
        index++;
      }

      if (
        Object.prototype.hasOwnProperty.call(data, "slug") ||
        (Object.prototype.hasOwnProperty.call(data, "name") && productColumns.has("slug"))
      ) {
        const nextSlug = await this.buildSlug(
          client,
          data.slug || data.name || existing.slug || existing.name,
          id,
        );
        updates.push(`slug = $${index}`);
        params.push(nextSlug);
        index++;
      }

      const mutableFields = [
        "vendor_id",
        "category_id",
        "description",
        "brand",
        "material",
        "care_instructions",
        "image_url",
        "base_price",
        "is_active",
      ];

      for (const field of mutableFields) {
        if (
          !productColumns.has(field) ||
          !Object.prototype.hasOwnProperty.call(data, field)
        ) {
          continue;
        }

        updates.push(`${field} = $${index}`);

        if (field === "vendor_id" || field === "category_id") {
          params.push(toNumberOrNull(data[field]));
        } else if (field === "base_price") {
          params.push(toNumberOrNull(data[field]) || 0);
        } else if (field === "is_active") {
          params.push(toBoolean(data[field], true));
        } else {
          params.push(data[field] || null);
        }

        index++;
      }

      if (productColumns.has("updated_by")) {
        updates.push(`updated_by = $${index}`);
        params.push(toNumberOrNull(data.actorUserId));
        index++;
      }

      if (!updates.length) {
        await client.query("ROLLBACK");
        return null;
      }

      params.push(id);
      await client.query(
        `UPDATE products
         SET ${updates.join(", ")}, updated_at = NOW()
         WHERE id = $${index} AND deleted_at IS NULL`,
        params,
      );

      if (
        Object.prototype.hasOwnProperty.call(data, "base_price") ||
        Object.prototype.hasOwnProperty.call(data, "stock") ||
        Object.prototype.hasOwnProperty.call(data, "sku") ||
        !data.variants
      ) {
        await this.upsertPrimaryVariant(
          client,
          id,
          data,
          variantColumns,
          data.slug || data.name || existing.slug,
        );
      }

      await client.query("COMMIT");
      return this.findByIdWithVariants(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
    const productColumns = await this.getTableColumns("products");
    const variantColumns = await this.getTableColumns("product_variants");
    const selectColumns = this.getProductSelectColumns(productColumns, variantColumns);

    const result = await pool.query(
      `SELECT ${selectColumns.join(", ")}
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN vendors v ON p.vendor_id = v.id
       LEFT JOIN product_variants pv ON p.id = pv.product_id
       WHERE p.deleted_at IS NULL
       GROUP BY p.id, c.name, v.store_name
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  }

  async findByIdWithVariants(productId) {
    const product = await this.findById(productId);
    if (!product) {
      return null;
    }

    const variantColumns = await this.getTableColumns("product_variants");
    const variantSelectColumns = this.getVariantSelectColumns(variantColumns);

    const variantsResult = await pool.query(
      `SELECT ${variantSelectColumns.join(", ")}
       FROM product_variants v
       WHERE v.product_id = $1 AND v.deleted_at IS NULL
       ORDER BY v.id ASC`,
      [productId],
    );

    product.variants = variantsResult.rows;
    return product;
  }
}

module.exports = new ProductRepository();
