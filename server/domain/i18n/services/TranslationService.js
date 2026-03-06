/**
 * Translation Service (i18n)
 * 
 * Manages multi-language content for:
 * - Product descriptions
 * - Category names
 * - Static page content
 * - UI strings
 * 
 * Features:
 * - Language fallback (missing translations fall back to default)
 * - In-memory caching with TTL
 * - Admin authorization for updates
 * - Audit trail for all modifications
 * - Multi-tenant support (if enabled)
 */

const BaseService = require("../../base/BaseService");

const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko'];

class TranslationService extends BaseService {
  /**
   * Initialize translation service
   * @param {object} dbPool - Database connection pool
   * @param {object} options - Configuration options
   *   - cacheTTL: Cache time-to-live in milliseconds (default: 3600000 = 1 hour)
   */
  constructor(dbPool, options = {}) {
    super();
    this.db = dbPool;
    this.cacheTTL = options.cacheTTL || 3600000; // 1 hour default
    this.cache = new Map(); // Cache structure: "type:id:lang" → { data, expiresAt }
    this.managePermissionCode = options.managePermissionCode || "translations:manage";
  }

  async _authorizeTranslationWrite(adminId) {
    if (!Number.isInteger(adminId) || adminId <= 0) {
      throw new Error("Unauthorized: Employee context is required");
    }
    await this.validatePermission(adminId, this.managePermissionCode);
  }

  /**
   * Validate language code
   * @throws {Error} if language code is invalid
   */
  validateLanguageCode(code) {
    if (!code || typeof code !== 'string' || code.length !== 2) {
      throw new Error(`Invalid language code: ${code}`);
    }
    // Allow any 2-letter code for internationalization, but warn on unknown
    const isSupported = SUPPORTED_LANGUAGES.includes(code);
    if (!isSupported && !code.match(/^[a-z]{2}$/)) {
      throw new Error(`Invalid language code format: ${code}`);
    }
    return code;
  }

  /**
   * Validate product ID
   * @throws {Error} if product ID is invalid
   */
  validateProductId(id) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`Invalid product ID: ${id}`);
    }
    return id;
  }

  /**
   * Get cache key for translation
   */
  getCacheKey(type, id, language) {
    return `${type}:${id}:${language}`;
  }

  /**
   * Check if cached item is still valid
   */
  isCacheValid(cacheKey) {
    if (!this.cache.has(cacheKey)) return false;
    const entry = this.cache.get(cacheKey);
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return false;
    }
    return true;
  }

  /**
   * Set cache entry with TTL
   */
  setCacheEntry(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + this.cacheTTL,
    });
  }

  /**
   * Get cached entry
   */
  getCacheEntry(cacheKey) {
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }
    return null;
  }

  /**
   * Invalidate cache for an entry
   */
  invalidateCache(cacheKey) {
    this.cache.delete(cacheKey);
  }

  /**
   * Get product translation with fallback
   * @param {number} productId - Product ID
   * @param {string} languageCode - Language code (e.g., 'es', 'fr')
   * @param {object} options - Optional parameters
   *   - tenantId: Tenant ID for multi-tenant isolation
   * @returns {Promise<object>} Translation object {name, description, language_code}
   */
  async getProductTranslation(productId, languageCode, options = {}) {
    const id = this.validateProductId(productId);
    const lang = this.validateLanguageCode(languageCode);

    const baseKey = this.getCacheKey('product', id, lang);
    const cacheKey = options.tenantId
      ? `${baseKey}:tenant:${options.tenantId}`
      : baseKey;
    const cached = this.getCacheEntry(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to fetch requested language
    let result = await this.db.query(
      `SELECT id, product_id, language_code, name, description
       FROM product_translations
       WHERE product_id = $1 AND language_code = $2`,
      [id, lang]
    );

    // If not found, fallback to default language
    if (result.rows.length === 0 && lang !== DEFAULT_LANGUAGE) {
      result = await this.db.query(
        `SELECT id, product_id, language_code, name, description
         FROM product_translations
         WHERE product_id = $1 AND language_code = $2`,
        [id, DEFAULT_LANGUAGE]
      );
    }

    if (result.rows.length === 0) {
      throw new Error(`No translation found for product ${id} in ${lang}`);
    }

    const translation = result.rows[0];
    this.setCacheEntry(cacheKey, translation);
    return translation;
  }

  /**
   * Get category translation
   */
  async getCategoryTranslation(categoryId, languageCode, options = {}) {
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new Error(`Invalid category ID: ${categoryId}`);
    }

    const lang = this.validateLanguageCode(languageCode);
    const cacheKey = this.getCacheKey('category', categoryId, lang);
    const cached = this.getCacheEntry(cacheKey);
    if (cached) {
      return cached;
    }

    // Try requested language
    let result = await this.db.query(
      `SELECT id, category_id, language_code, name, description
       FROM category_translations
       WHERE category_id = $1 AND language_code = $2`,
      [categoryId, lang]
    );

    // Fallback to default
    if (result.rows.length === 0 && lang !== DEFAULT_LANGUAGE) {
      result = await this.db.query(
        `SELECT id, category_id, language_code, name, description
         FROM category_translations
         WHERE category_id = $1 AND language_code = $2`,
        [categoryId, DEFAULT_LANGUAGE]
      );
    }

    if (result.rows.length === 0) {
      throw new Error(`No translation found for category ${categoryId} in ${lang}`);
    }

    const translation = result.rows[0];
    this.setCacheEntry(cacheKey, translation);
    return translation;
  }

  /**
   * Get static page translation
   */
  async getStaticPageTranslation(pageSlug, languageCode) {
    if (!pageSlug || typeof pageSlug !== 'string') {
      throw new Error(`Invalid page slug: ${pageSlug}`);
    }

    const lang = this.validateLanguageCode(languageCode);
    const cacheKey = this.getCacheKey('page', pageSlug, lang);
    const cached = this.getCacheEntry(cacheKey);
    if (cached) {
      return cached;
    }

    // Try requested language
    let result = await this.db.query(
      `SELECT page_slug, language_code, title, content, meta_description
       FROM page_translations
       WHERE page_slug = $1 AND language_code = $2`,
      [pageSlug, lang]
    );

    // Fallback to default
    if (result.rows.length === 0 && lang !== DEFAULT_LANGUAGE) {
      result = await this.db.query(
        `SELECT page_slug, language_code, title, content, meta_description
         FROM page_translations
         WHERE page_slug = $1 AND language_code = $2`,
        [pageSlug, DEFAULT_LANGUAGE]
      );
    }

    if (result.rows.length === 0) {
      // Return empty object instead of throwing for pages that may not exist
      return { page_slug: pageSlug, language_code: lang, title: '', content: '' };
    }

    const translation = result.rows[0];
    this.setCacheEntry(cacheKey, translation);
    return translation;
  }

  /**
   * Update product translation (Admin only)
   * @throws {Error} if user is not admin
   */
  async updateProductTranslation(productId, languageCode, updateData, adminId) {
    const id = this.validateProductId(productId);
    const lang = this.validateLanguageCode(languageCode);

    await this._authorizeTranslationWrite(adminId);

    // Validate update data
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Invalid update data');
    }

    try {
      // Upsert translation
      const result = await this.db.query(
        `INSERT INTO product_translations (product_id, language_code, name, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (product_id, language_code) 
         DO UPDATE SET name = $3, description = $4, updated_at = NOW()
         RETURNING id`,
        [id, lang, updateData.name, updateData.description]
      );

      const translationId = result.rows[0].id;

      // Create audit log
      await this.db.query(
        `INSERT INTO translation_audit_log 
         (translation_id, type, language_code, change_summary, admin_id, created_at)
         VALUES ($1, 'product', $2, $3, $4, NOW())`,
        [translationId, lang, JSON.stringify(updateData), adminId]
      );

      // Invalidate cache
      const cacheKey = this.getCacheKey('product', id, lang);
      this.invalidateCache(cacheKey);

      return { id: translationId, productId: id, languageCode: lang, ...updateData };
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error(`Translation already exists for product ${id} in ${lang}`);
      }
      throw error;
    }
  }

  /**
   * Get all translations for a product
   */
  async getAllProductTranslations(productId) {
    const id = this.validateProductId(productId);

    const result = await this.db.query(
      `SELECT id, product_id, language_code, name, description, updated_at
       FROM product_translations
       WHERE product_id = $1
       ORDER BY language_code`,
      [id]
    );

    return result.rows;
  }

  /**
   * Bulk update translations (Admin only)
   * @returns {object} {successful: number, failed: number, errors: array}
   */
  async bulkUpdateTranslations(type, languageCode, updates, adminId) {
    const lang = this.validateLanguageCode(languageCode);

    await this._authorizeTranslationWrite(adminId);

    const results = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        if (type === 'category') {
          await this.updateCategoryTranslation(update.categoryId, lang, update, adminId);
        } else if (type === 'product') {
          await this.updateProductTranslation(update.productId, lang, update, adminId);
        }
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: updates.indexOf(update),
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Update category translation (Admin only)
   */
  async updateCategoryTranslation(categoryId, languageCode, updateData, adminId) {
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new Error(`Invalid category ID: ${categoryId}`);
    }

    const lang = this.validateLanguageCode(languageCode);

    await this._authorizeTranslationWrite(adminId);

    try {
      const result = await this.db.query(
        `INSERT INTO category_translations (category_id, language_code, name, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (category_id, language_code)
         DO UPDATE SET name = $3, description = $4, updated_at = NOW()
         RETURNING id`,
        [categoryId, lang, updateData.name, updateData.description]
      );

      const translationId = result.rows[0].id;

      // Audit log
      await this.db.query(
        `INSERT INTO translation_audit_log 
         (translation_id, type, language_code, change_summary, admin_id, created_at)
         VALUES ($1, 'category', $2, $3, $4, NOW())`,
        [translationId, lang, JSON.stringify(updateData), adminId]
      );

      // Invalidate cache
      const cacheKey = this.getCacheKey('category', categoryId, lang);
      this.invalidateCache(cacheKey);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error(`Translation already exists for category ${categoryId} in ${lang}`);
      }
      throw error;
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages() {
    const result = await this.db.query(
      `SELECT language_code, language_name, is_active, is_default
       FROM supported_languages
       ORDER BY is_default DESC, language_code`
    );
    return result.rows;
  }

  /**
   * Add new language support (Admin only)
   */
  async addLanguageSupport(languageCode, languageName, nativeName, adminId = 1) {
    const code = this.validateLanguageCode(languageCode);

    await this._authorizeTranslationWrite(adminId);

    const result = await this.db.query(
      `INSERT INTO supported_languages 
       (language_code, language_name, native_name, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING language_code`,
      [code, languageName, nativeName]
    );

    return result.rows[0];
  }

  /**
   * Get default language for fallback
   */
  async getDefaultLanguage() {
    const result = await this.db.query(
      `SELECT language_code, language_name, is_default
       FROM supported_languages
       WHERE is_default = true
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      // Return English as hardcoded default
      return { language_code: DEFAULT_LANGUAGE, language_name: 'English', is_default: true };
    }

    return result.rows[0];
  }

  /**
   * Get translation string by key (for UI strings)
   * Returns translations in all languages
   */
  async getTranslationStringByKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid translation key');
    }

    const result = await this.db.query(
      `SELECT language_code, translated_value, key
       FROM translation_strings
       WHERE key = $1
       ORDER BY language_code`,
      [key]
    );

    return result.rows;
  }

  /**
   * Update translation string (Admin only)
   */
  async updateTranslationString(key, languageCode, value, adminId) {
    const lang = this.validateLanguageCode(languageCode);

    await this._authorizeTranslationWrite(adminId);

    const result = await this.db.query(
      `INSERT INTO translation_strings (key, language_code, translated_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (key, language_code)
       DO UPDATE SET translated_value = $3, updated_at = NOW()
       RETURNING id`,
      [key, lang, value]
    );

    return result.rows[0];
  }

  /**
   * Warm cache for a language (preload common translations)
   * Called on application startup
   */
  async warmCache(languageCode) {
    const lang = this.validateLanguageCode(languageCode);

    // Load product translations  
    const products = await this.db.query(
      `SELECT id, product_id, language_code, name, description
       FROM product_translations
       WHERE language_code = $1
       LIMIT 100`,
      [lang]
    );

    // Add to cache
    if (products && products.rows) {
      for (const row of products.rows) {
        const key = this.getCacheKey('product', row.product_id, lang);
        this.setCacheEntry(key, row);
      }
    }

    console.log(`Warmed cache for language ${lang}`);
  }

  /**
   * Get current cache size
   */
  getCacheSize() {
    return this.cache.size;
  }

  /**
   * Clear all cache (useful for testing or maintenance)
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = TranslationService;
