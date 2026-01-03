const { pool } = require("../config/db");

// Validation helpers
const validateProductId = (id) => {
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    return { valid: false, error: "Invalid product ID supplied" };
  }
  return { valid: true, id: parsedId };
};

const validateProductRequest = (body) => {
  const { name, brand, base_price } = body;

  const errors = [];

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    errors.push("name is required and must be a non-empty string");
  }

  if (!brand || typeof brand !== "string" || brand.trim().length === 0) {
    errors.push("brand is required and must be a non-empty string");
  }

  if (base_price === undefined || base_price === null) {
    errors.push("base_price is required");
  } else if (typeof base_price !== "number" || base_price < 0) {
    errors.push("base_price must be a positive number");
  }

  return { valid: errors.length === 0, errors };
};

const formatProduct = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || null,
  brand: row.brand,
  material: row.material || null,
  care_instructions: row.care_instructions || null,
  base_price: row.base_price,
  is_active: row.is_active,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// Get all products with pagination
exports.listProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || 1, 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize || 20, 10)));
    const sort = req.query.sort || "id";
    const order = (req.query.order || "ASC").toUpperCase();

    // Whitelist allowed sort columns to prevent SQL injection
    const allowedSortColumns = ["id", "name", "brand", "base_price", "created_at", "updated_at"];
    if (!allowedSortColumns.includes(sort)) {
      return res.status(400).json({ error: "Invalid sort column" });
    }

    if (!["ASC", "DESC"].includes(order)) {
      return res.status(400).json({ error: "order must be ASC or DESC" });
    }

    const offset = (page - 1) * pageSize;

    const countResult = await pool.query("SELECT COUNT(*) as count FROM products WHERE is_active = true");
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT * FROM products WHERE is_active = true ORDER BY ${sort} ${order} LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    const hasNext = offset + pageSize < total;

    res.status(200).json({
      data: result.rows.map(formatProduct),
      pagination: {
        page,
        pageSize,
        total,
        hasNext,
      },
    });
  } catch (error) {
    console.error("List products error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const validation = validateProductRequest(req.body);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join("; ") });
    }

    const { name, description, brand, material, care_instructions, base_price, is_active } = req.body;

    const result = await pool.query(
      `INSERT INTO products (name, description, brand, material, care_instructions, base_price, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        name.trim(),
        description || null,
        brand.trim(),
        material || null,
        care_instructions || null,
        base_price,
        is_active !== false,
      ]
    );

    res.status(201).json(formatProduct(result.rows[0]));
  } catch (error) {
    console.error("Create product error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get a product by ID
exports.getProductById = async (req, res) => {
  try {
    const validation = validateProductId(req.params.productId);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await pool.query("SELECT * FROM products WHERE id = $1", [validation.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(formatProduct(result.rows[0]));
  } catch (error) {
    console.error("Get product error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update a product (full replacement)
exports.replaceProduct = async (req, res) => {
  try {
    const validation = validateProductId(req.params.productId);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const bodyValidation = validateProductRequest(req.body);

    if (!bodyValidation.valid) {
      return res.status(400).json({ error: bodyValidation.errors.join("; ") });
    }

    const { name, description, brand, material, care_instructions, base_price, is_active } = req.body;

    const result = await pool.query(
      `UPDATE products 
       SET name = $1, description = $2, brand = $3, material = $4, care_instructions = $5, 
           base_price = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [
        name.trim(),
        description || null,
        brand.trim(),
        material || null,
        care_instructions || null,
        base_price,
        is_active !== false,
        validation.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(formatProduct(result.rows[0]));
  } catch (error) {
    console.error("Replace product error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Partial update of a product
exports.updateProductPartial = async (req, res) => {
  try {
    const validation = validateProductId(req.params.productId);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { name, description, brand, material, care_instructions, base_price, is_active } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "name must be a non-empty string" });
      }
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description || null);
    }

    if (brand !== undefined) {
      if (typeof brand !== "string" || brand.trim().length === 0) {
        return res.status(400).json({ error: "brand must be a non-empty string" });
      }
      updates.push(`brand = $${paramIndex++}`);
      values.push(brand.trim());
    }

    if (material !== undefined) {
      updates.push(`material = $${paramIndex++}`);
      values.push(material || null);
    }

    if (care_instructions !== undefined) {
      updates.push(`care_instructions = $${paramIndex++}`);
      values.push(care_instructions || null);
    }

    if (base_price !== undefined) {
      if (typeof base_price !== "number" || base_price < 0) {
        return res.status(400).json({ error: "base_price must be a positive number" });
      }
      updates.push(`base_price = $${paramIndex++}`);
      values.push(base_price);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active === true);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updates.push(`updated_at = NOW()`);
    values.push(validation.id);

    const result = await pool.query(
      `UPDATE products SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(formatProduct(result.rows[0]));
  } catch (error) {
    console.error("Update product error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const validation = validateProductId(req.params.productId);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await pool.query("DELETE FROM products WHERE id = $1 RETURNING *", [validation.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Delete product error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
