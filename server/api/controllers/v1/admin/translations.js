const { pool } = require("../../../../config/db");
const AdminAuthService = require("../../../../domain/admin/AdminAuthService");

const adminAuthService = new AdminAuthService();

/**
 * Translations Controller
 * Manages content translations for i18n support
 */

exports.listLanguages = async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        language_code,
        language_name,
        is_active,
        created_at
      FROM supported_languages
      ORDER BY is_active DESC, language_name ASC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error listing languages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getProductTranslations = async (req, res) => {
  try {
    const { productId } = req.params;
    const { languageCode = null } = req.query;

    let query = `
      SELECT 
        pt.id,
        pt.product_id,
        pt.language_code,
        pt.name,
        pt.description,
        pt.created_at,
        pt.updated_at
      FROM product_translations pt
      WHERE pt.product_id = $1
    `;

    const params = [productId];

    if (languageCode) {
      query += ` AND pt.language_code = $${params.length + 1}`;
      params.push(languageCode);
    }

    query += ` ORDER BY pt.language_code`;

    const result = await pool.query(query, params);

    res.json({
      productId,
      translations: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error getting product translations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createProductTranslation = async (req, res) => {
  try {
    const { productId } = req.params;
    const { languageCode, name, description } = req.body;

    // Validation
    if (!languageCode || !name) {
      return res.status(400).json({
        error: "Language code and name are required",
      });
    }

    // Check language exists and is active
    const langCheck = await pool.query(
      "SELECT id FROM supported_languages WHERE language_code = $1 AND is_active = true",
      [languageCode]
    );
    if (langCheck.rows.length === 0) {
      return res.status(400).json({
        error: `Language '${languageCode}' is not active or does not exist`,
      });
    }

    // Check product exists
    const prodCheck = await pool.query("SELECT id FROM products WHERE id = $1", [
      productId,
    ]);
    if (prodCheck.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check duplicate translation
    const existing = await pool.query(
      "SELECT id FROM product_translations WHERE product_id = $1 AND language_code = $2",
      [productId, languageCode]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: `Translation already exists for ${languageCode}`,
      });
    }

    // Insert translation
    const query = `
      INSERT INTO product_translations (product_id, language_code, name, description, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, product_id, language_code, name, description, created_at
    `;

    const result = await pool.query(query, [
      productId,
      languageCode,
      name,
      description || null,
    ]);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "translation:create",
      "product_translation",
      result.rows[0].id,
      { productId, languageCode, name }
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating translation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateProductTranslation = async (req, res) => {
  try {
    const { productId, translationId } = req.params;
    const { name, description } = req.body;

    // Check translation exists
    const existing = await pool.query(
      "SELECT language_code FROM product_translations WHERE id = $1 AND product_id = $2",
      [translationId, productId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Translation not found" });
    }

    let updateQuery = "UPDATE product_translations SET updated_at = NOW()";
    const params = [];

    if (name !== undefined) {
      updateQuery += `, name = $${params.length + 1}`;
      params.push(name);
    }

    if (description !== undefined) {
      updateQuery += `, description = $${params.length + 1}`;
      params.push(description);
    }

    if (params.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updateQuery += ` WHERE id = $${params.length + 1} AND product_id = $${params.length + 2}`;
    params.push(translationId);
    params.push(productId);
    updateQuery += ` RETURNING id, product_id, language_code, name, description, updated_at`;

    const result = await pool.query(updateQuery, params);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "translation:update",
      "product_translation",
      translationId,
      { changes: { name, description }, languageCode: existing.rows[0].language_code }
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating translation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteProductTranslation = async (req, res) => {
  try {
    const { productId, translationId } = req.params;

    const existing = await pool.query(
      "SELECT language_code FROM product_translations WHERE id = $1 AND product_id = $2",
      [translationId, productId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Translation not found" });
    }

    // Don't delete English translations (default language)
    if (existing.rows[0].language_code === "en") {
      return res.status(403).json({
        error: "Cannot delete English translation (default language)",
      });
    }

    await pool.query(
      "DELETE FROM product_translations WHERE id = $1 AND product_id = $2",
      [translationId, productId]
    );

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "translation:delete",
      "product_translation",
      translationId,
      { languageCode: existing.rows[0].language_code }
    );

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting translation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getCategoryTranslations = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { languageCode = null } = req.query;

    let query = `
      SELECT 
        ct.id,
        ct.category_id,
        ct.language_code,
        ct.name,
        ct.description,
        ct.created_at,
        ct.updated_at
      FROM category_translations ct
      WHERE ct.category_id = $1
    `;

    const params = [categoryId];

    if (languageCode) {
      query += ` AND ct.language_code = $${params.length + 1}`;
      params.push(languageCode);
    }

    query += ` ORDER BY ct.language_code`;

    const result = await pool.query(query, params);

    res.json({
      categoryId,
      translations: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error getting category translations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createCategoryTranslation = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { languageCode, name, description } = req.body;

    // Validation
    if (!languageCode || !name) {
      return res.status(400).json({
        error: "Language code and name are required",
      });
    }

    // Check language exists and is active
    const langCheck = await pool.query(
      "SELECT id FROM supported_languages WHERE language_code = $1 AND is_active = true",
      [languageCode]
    );
    if (langCheck.rows.length === 0) {
      return res.status(400).json({
        error: `Language '${languageCode}' is not active or does not exist`,
      });
    }

    // Check category exists
    const catCheck = await pool.query(
      "SELECT id FROM categories WHERE id = $1",
      [categoryId]
    );
    if (catCheck.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check duplicate translation
    const existing = await pool.query(
      "SELECT id FROM category_translations WHERE category_id = $1 AND language_code = $2",
      [categoryId, languageCode]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: `Translation already exists for ${languageCode}`,
      });
    }

    // Insert translation
    const query = `
      INSERT INTO category_translations (category_id, language_code, name, description, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, category_id, language_code, name, description, created_at
    `;

    const result = await pool.query(query, [
      categoryId,
      languageCode,
      name,
      description || null,
    ]);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "translation:create",
      "category_translation",
      result.rows[0].id,
      { categoryId, languageCode, name }
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating category translation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateCategoryTranslation = async (req, res) => {
  try {
    const { categoryId, translationId } = req.params;
    const { name, description } = req.body;

    // Check translation exists
    const existing = await pool.query(
      "SELECT language_code FROM category_translations WHERE id = $1 AND category_id = $2",
      [translationId, categoryId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Translation not found" });
    }

    let updateQuery = "UPDATE category_translations SET updated_at = NOW()";
    const params = [];

    if (name !== undefined) {
      updateQuery += `, name = $${params.length + 1}`;
      params.push(name);
    }

    if (description !== undefined) {
      updateQuery += `, description = $${params.length + 1}`;
      params.push(description);
    }

    if (params.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updateQuery += ` WHERE id = $${params.length + 1} AND category_id = $${params.length + 2}`;
    params.push(translationId);
    params.push(categoryId);
    updateQuery += ` RETURNING id, category_id, language_code, name, description, updated_at`;

    const result = await pool.query(updateQuery, params);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "translation:update",
      "category_translation",
      translationId,
      { changes: { name, description }, languageCode: existing.rows[0].language_code }
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating category translation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteCategoryTranslation = async (req, res) => {
  try {
    const { categoryId, translationId } = req.params;

    const existing = await pool.query(
      "SELECT language_code FROM category_translations WHERE id = $1 AND category_id = $2",
      [translationId, categoryId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Translation not found" });
    }

    // Don't delete English translations
    if (existing.rows[0].language_code === "en") {
      return res.status(403).json({
        error: "Cannot delete English translation (default language)",
      });
    }

    await pool.query(
      "DELETE FROM category_translations WHERE id = $1 AND category_id = $2",
      [translationId, categoryId]
    );

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "translation:delete",
      "category_translation",
      translationId,
      { languageCode: existing.rows[0].language_code }
    );

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting category translation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
