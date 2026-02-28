class BaseRepository {
  constructor(pool, tableName) {
    this.pool = pool;
    this.tableName = tableName;
  }

  // Find by ID
  async findById(id) {
    const result = await this.pool.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return result.rows[0] || null;
  }

  // Find all with optional filters
  async findAll(filters = {}, options = {}) {
    const {
      limit = 20,
      offset = 0,
      orderBy = "id",
      orderDirection = "ASC",
    } = options;

    let query = `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL`;
    const params = [];
    let paramIndex = 1;

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query += ` AND ${key} = $${paramIndex}`;
        params.push(value);
        paramIndex++;
      }
    }

    query += ` ORDER BY ${orderBy} ${orderDirection} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // Create new record
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

    const query = `
      INSERT INTO ${this.tableName} (${keys.join(", ")})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // Update record
  async update(id, data) {
    const updates = Object.keys(data)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(", ");

    const query = `
      UPDATE ${this.tableName}
      SET ${updates}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.pool.query(query, [id, ...Object.values(data)]);
    return result.rows[0] || null;
  }

  // Soft delete
  async softDelete(id) {
    const result = await this.pool.query(
      `UPDATE ${this.tableName} SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id],
    );
    return result.rows[0] || null;
  }

  // Hard delete (use with caution)
  async hardDelete(id) {
    const result = await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`,
      [id],
    );
    return result.rows[0] || null;
  }

  // Count records with optional filters
  async count(filters = {}) {
    let query = `SELECT COUNT(*) FROM ${this.tableName} WHERE deleted_at IS NULL`;
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query += ` AND ${key} = $${paramIndex}`;
        params.push(value);
        paramIndex++;
      }
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count);
  }
}

module.exports = BaseRepository;
