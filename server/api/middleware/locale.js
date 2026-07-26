/**
 * Locale Middleware
 * 
 * Detects and applies user language preference from multiple sources:
 * 1. URL query parameter (?lang=es)
 * 2. Cookie (language=fr)
 * 3. User preference (authenticated users)
 * 4. Accept-Language header (HTTP)
 * 5. Default (English)
 */

const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ar'];
const DEFAULT_LANGUAGE = 'en';
const EXPOSED_LANGUAGES = ['en', 'es', 'fr', 'de', 'ja'];
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

class LocaleMiddleware {
  /**
   * Initialize middleware
   * @param {object} userService - Service for user language preferences
   * @param {object} options - Configuration options
   *   - supportedLanguages: array of language codes
   *   - defaultLanguage: fallback language
   *   - onLanguageSwitch: callback for language changes
   */
  constructor(userService, options = {}) {
    this.userService = userService;
    this.options = options;
    this.supportedLanguages = options.supportedLanguages || SUPPORTED_LANGUAGES;
    this.exposedLanguages = options.exposedLanguages || EXPOSED_LANGUAGES;
    this.defaultLanguage = options.defaultLanguage || DEFAULT_LANGUAGE;
    this.preferenceCache = new Map(); // Cache user preferences
  }

  /**
   * Parse Accept-Language header
   * Returns language code with highest quality score
   * Example: "en-US,en;q=0.9,fr;q=0.8" → "en"
   */
  parseAcceptLanguage(header) {
    if (!header || typeof header !== 'string') {
      return this.defaultLanguage;
    }

    try {
      // Split by comma and parse quality scores
      const languages = header.split(',').map(lang => {
        const [code, q] = lang.trim().split(';q=');
        const quality = q ? parseFloat(q) : 1;
        return { code: code.trim().toLowerCase(), quality };
      });

      // Find language with highest quality
      let best = languages[0];
      for (const lang of languages) {
        if (lang.quality > best.quality) {
          best = lang;
        }
      }

      // Extract base language code (e.g., en-US → en)
      return best.code;
    } catch (error) {
      // Return default on parse error
      return this.defaultLanguage;
    }
  }

  extractVariant(code) {
    if (!code || typeof code !== 'string') {
      return undefined;
    }

    const [, variant] = code.split(/[-_]/);
    return variant ? variant.toUpperCase() : undefined;
  }

  appendVaryHeader(res, value) {
    if (!res || typeof res.getHeader !== 'function' || typeof res.setHeader !== 'function') {
      return;
    }

    const current = res.getHeader('Vary');
    if (!current) {
      res.setHeader('Vary', value);
      return;
    }

    const values = String(current)
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);

    if (!values.includes(String(value).toLowerCase())) {
      res.setHeader('Vary', `${current}, ${value}`);
    }
  }

  setLanguageCookie(res, language) {
    if (!res || !language) {
      return;
    }

    const secure = process.env.NODE_ENV === 'production';
    const sameSite = secure ? 'lax' : 'lax';
    const maxAgeMs = 365 * 24 * 60 * 60 * 1000;

    if (typeof res.cookie === 'function') {
      res.cookie('language', language, {
        path: '/',
        maxAge: maxAgeMs,
        secure,
        sameSite,
      });
      return;
    }

    if (typeof res.getHeader !== 'function' || typeof res.setHeader !== 'function') {
      return;
    }

    const cookieValue = `language=${encodeURIComponent(language)}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? '; Secure' : ''}`;
    const existing = res.getHeader('Set-Cookie');

    if (!existing) {
      res.setHeader('Set-Cookie', cookieValue);
      return;
    }

    if (Array.isArray(existing)) {
      res.setHeader('Set-Cookie', [...existing, cookieValue]);
      return;
    }

    res.setHeader('Set-Cookie', [String(existing), cookieValue]);
  }

  applyResponseLocale(res, language, rawCode) {
    if (!res.locals) {
      res.locals = {};
    }

    res.locals.language = language;
    res.locals.primaryLanguage = language;
    if (!res.locals.fallbackLanguage) {
      res.locals.fallbackLanguage = this.defaultLanguage;
    }

    const variant = this.extractVariant(rawCode);
    if (variant) {
      res.locals.variant = variant;
    }

    res.locals.availableLanguages = this.exposedLanguages;

    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Language', language);
      res.setHeader('X-Available-Languages', this.exposedLanguages.join(', '));
      res.setHeader('X-Text-Direction', RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr');
      this.appendVaryHeader(res, 'Accept-Language');
    }
  }

  sendJson(res, statusCode, payload) {
    if (typeof res.status === 'function') {
      return res.status(statusCode).json(payload);
    }
    if (typeof res.json === 'function') {
      return res.json(payload);
    }
    return payload;
  }

  /**
   * Normalize language code
   * en-GB → en, en_GB → en, EN → en
   */
  normalizeLanguageCode(code) {
    if (!code || typeof code !== 'string') {
      return null;
    }

    // Convert to lowercase and extract base code
    const normalized = code.toLowerCase().split(/[-_]/)[0];
    return normalized.length === 2 ? normalized : null;
  }

  /**
   * Check if language is supported
   */
  isSupported(language) {
    if (!language) return false;
    const normalized = this.normalizeLanguageCode(language);
    return normalized && this.supportedLanguages.includes(normalized);
  }

  /**
   * Detect locale from request (main middleware function)
   * Sets res.locals.language with detected language
   */
  async detectLocale(req, res, next) {
    let detectedLanguage = this.defaultLanguage;

    if (!res.locals) {
      res.locals = {};
    }

    // Priority 1: URL query parameter (?lang=es)
    if (req.query && req.query.lang && this.isSupported(req.query.lang)) {
      const requestedLanguage = req.query.lang;
      detectedLanguage = this.normalizeLanguageCode(requestedLanguage);

      if (req.user && this.userService && this.userService.setUserLanguagePreference) {
        const cacheKey = `user:${req.user.id}`;
        const previous = this.preferenceCache.get(cacheKey) || this.defaultLanguage;

        if (previous !== detectedLanguage) {
          const tenantContext = req.user.tenantId ? { tenantId: req.user.tenantId } : undefined;
          await this.setUserLanguage(req.user.id, detectedLanguage, tenantContext);

          if (this.options && this.options.onLanguageSwitch) {
            this.options.onLanguageSwitch({
              userId: req.user.id,
              from: previous,
              to: detectedLanguage,
              timestamp: new Date(),
            });
          }
        }
      }

      this.setLanguageCookie(res, detectedLanguage);

      this.applyResponseLocale(res, detectedLanguage, requestedLanguage);
      if (next) next();
      return;
    }

    // Priority 2: Cookie
    if (req.cookies && req.cookies.language && this.isSupported(req.cookies.language)) {
      detectedLanguage = this.normalizeLanguageCode(req.cookies.language);
      this.applyResponseLocale(res, detectedLanguage, req.cookies.language);
      if (next) next();
      return;
    }

    // Priority 3: User preference (if authenticated)
    if (req.user && this.userService) {
      try {
        const cacheKey = `user:${req.user.id}`;
        let userLang = this.preferenceCache.get(cacheKey);

        if (!userLang) {
          userLang = await this.userService.getUserLanguagePreference(req.user.id);
          if (userLang) {
            this.preferenceCache.set(cacheKey, userLang);
          }
        }

        if (userLang && typeof userLang === 'object') {
          const preferred = userLang.preferred;
          const fallback = userLang.fallback;

          if (preferred && this.isSupported(preferred)) {
            detectedLanguage = this.normalizeLanguageCode(preferred);
            res.locals.fallbackLanguage = this.isSupported(fallback)
              ? this.normalizeLanguageCode(fallback)
              : this.defaultLanguage;
            this.applyResponseLocale(res, detectedLanguage, preferred);
            if (next) next();
            return;
          }
        }

        if (userLang && this.isSupported(userLang)) {
          detectedLanguage = this.normalizeLanguageCode(userLang);
          this.applyResponseLocale(res, detectedLanguage, userLang);
          if (next) next();
          return;
        }
      } catch (error) {
        // Fall through to next priority on error
        console.warn('Error fetching user language preference:', error.message);
      }
    }

    // Priority 4: Accept-Language header
    if (req.headers && req.headers['accept-language']) {
      const headerLang = this.parseAcceptLanguage(req.headers['accept-language']);
      if (headerLang && this.isSupported(headerLang)) {
        detectedLanguage = this.normalizeLanguageCode(headerLang);
        this.applyResponseLocale(res, detectedLanguage, headerLang);
        if (next) next();
        return;
      }
    }

    // Priority 5: Default
    this.applyResponseLocale(res, this.defaultLanguage, this.defaultLanguage);
    if (next) next();
  }

  /**
   * Middleware function for Express
   * Returns a middleware function that can be used with app.use()
   */
  middleware() {
    return async (req, res, next) => {
      await this.detectLocale(req, res, next);
    };
  }

  /**
   * Set user language preference (for language switching)
   */
  async setUserLanguage(userId, language, context) {
    if (!this.isSupported(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const normalized = this.normalizeLanguageCode(language);
    if (this.userService && this.userService.setUserLanguagePreference) {
      if (context && context.tenantId) {
        await this.userService.setUserLanguagePreference(userId, normalized, {
          tenantId: context.tenantId,
        });
      } else {
        await this.userService.setUserLanguagePreference(userId, normalized);
      }
    }

    // Update cache
    const cacheKey = `user:${userId}`;
    this.preferenceCache.set(cacheKey, normalized);

    return { userId, language: normalized };
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  /**
   * Clear preference cache (useful for testing)
   */
  clearCache() {
    this.preferenceCache.clear();
  }

  /**
   * Get cached user preference without fetching from service
   */
  getCachedUserLanguage(userId) {
    const cacheKey = `user:${userId}`;
    return this.preferenceCache.get(cacheKey);
  }

  /**
   * Handler for language switching
   * Typically used with POST /api/language-switch
   */
  handleLanguageSwitch() {
    return async (req, res) => {
      const requestedLanguage = req?.body?.language || req?.query?.lang;

      if (!req.user || !requestedLanguage) {
        return this.sendJson(res, 400, { error: 'Missing user or language' });
      }

      try {
        // Validate language
        if (!this.isSupported(requestedLanguage)) {
          return this.sendJson(res, 400, { error: 'Unsupported language' });
        }

        // Set user preference
        const normalized = this.normalizeLanguageCode(requestedLanguage);
        const tenantContext = req.user.tenantId ? { tenantId: req.user.tenantId } : undefined;
        await this.setUserLanguage(req.user.id, normalized, tenantContext);

        const cacheKey = `user:${req.user.id}`;
        this.preferenceCache.delete(cacheKey);

        // Fire audit callback if provided
        if (this.options && this.options.onLanguageSwitch) {
          this.options.onLanguageSwitch({
            userId: req.user.id,
            language: normalized,
            timestamp: new Date(),
          });
        }

        // Update response locals
        this.applyResponseLocale(res, normalized, requestedLanguage);

        // Set language cookie
        this.setLanguageCookie(res, normalized);

        return this.sendJson(res, 200, { success: true, language: normalized });
      } catch (error) {
        console.error('Language switch error:', error);
        return this.sendJson(res, 500, { error: error.message });
      }
    };
  }

  getFallbackLanguage(res) {
    return res?.locals?.fallbackLanguage || this.defaultLanguage;
  }

  localizedApiResponse() {
    return (payload = {}) => {
      const language = payload.language || this.defaultLanguage;
      return {
        ...payload,
        meta: {
          ...(payload.meta || {}),
          language,
          timestamp: new Date().toISOString(),
        },
      };
    };
  }

  /**
   * Warm cache with common translations
   */
  async warmCache(languages = []) {
    // Pre-populate cache with default translations for common languages
    for (const lang of languages) {
      if (this.isSupported(lang)) {
        const normalized = this.normalizeLanguageCode(lang);
        const cacheKey = `lang:${normalized}`;
        this.preferenceCache.set(cacheKey, { language: normalized, warmed: true });
      }
    }
  }

  /**
   * Get cache size (for testing)
   */
  getCacheSize() {
    return this.preferenceCache.size;
  }
}

module.exports = LocaleMiddleware;

