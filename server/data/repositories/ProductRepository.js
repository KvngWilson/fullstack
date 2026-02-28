const BaseRepository = require("./BaseRepository");

class ProductRepository extends BaseRepository {
  constructor(pool) {
    super(pool, "products");
  }

  /**
   * Find products with category info and pagination
   */
  async findAllWithCategory(filters = {}, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      sort = "id",
      order = "asc",
      categoryId,
      search,
    } = options;

    const limit = Math.min(100, parseInt(pageSize));
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.category_id,
        p.created_at,
        c.name as category_name,
        COUNT(*) OVER() as total_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL
    `;

    const params = [];
    let paramIndex = 1;

    if (categoryId) {
      query += ` AND p.category_id = $${paramIndex}`;
      params.push(categoryId);
      paramIndex++;
    }

    if (search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Safe ORDER BY (validated by queryBuilder)
    const { buildOrderByClause } = require("../../utils/queryBuilder");
    const orderByClause = buildOrderByClause("products", sort, order);

    query += ` ${orderByClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    const totalCount =
      result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const products = result.rows.map(({ total_count, ...product }) => product);

    return {
      products,
      pagination: {
        page: parseInt(page),
        pageSize: limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Find product with variants and inventory
   */
  async findByIdWithVariants(productId) {
    const productResult = await this.pool.query(
      `SELECT
        p.*,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [productId],
    );

    if (productResult.rows.length === 0) {
      return null;
    }

    const product = productResult.rows[0];

    const variantsResult = await this.pool.query(
      `SELECT
        v.id,
        v.sku,
        v.price,
        v.stock,
        v.attributes
      FROM product_variants v
      WHERE v.product_id = $1 AND v.deleted_at IS NULL`,
      [productId],
    );

    product.variants = variantsResult.rows;

    return product;
  }
}

module.exports = ProductRepository;
