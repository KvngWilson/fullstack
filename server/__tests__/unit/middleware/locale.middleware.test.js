/**
 * Locale Middleware Tests
 * Test-Driven Development: Tests for language detection and application
 * 
 * Responsibilities:
 * - Detect language from: Accept-Language header, user preference, cookie
 * - Apply locale to responses
 * - Support language switching
 * - Cache user locale preferences
 */


const LocaleMiddleware = require('../../../../server/api/middleware/locale.middleware');

describe('Locale Middleware', () => {
  let middleware;
  let req;
  let res;
  let next;
  let userServiceMock;

  beforeEach(() => {
    userServiceMock = {
      getUserLanguagePreference: jest.fn(),
      setUserLanguagePreference: jest.fn(),
    };

    middleware = new LocaleMiddleware(userServiceMock);

    req = {
      headers: {
        'accept-language': 'en-US,en;q=0.9,es;q=0.8',
      },
      cookies: {},
      user: null,
    };

    res = {
      locals: {},
      getHeader: jest.fn(),
      setHeader: jest.fn(),
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  describe('Language Detection Priority', () => {
    it('should detect language from URL parameter with highest priority', () => {
      // Arrange
      req.query = { lang: 'fr' };
      req.headers['accept-language'] = 'en-US'; // Different language

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: URL lang takes priority
      expect(res.locals.language).toBe('fr');
      next();
    });

    it('should detect language from cookie if no URL param', () => {
      // Arrange
      req.cookies = { language: 'de' };
      req.headers['accept-language'] = 'en-US';

      // Act
      middleware.detectLocale(req, res, next);

      // Assert
      expect(res.locals.language).toBe('de');
    });

    it('should detect language from user preference if authenticated', async () => {
      // Arrange
      req.user = { id: 1 };
      req.headers['accept-language'] = 'en-US';
      userServiceMock.getUserLanguagePreference.mockResolvedValueOnce('ja');

      // Act
      await middleware.detectLocale(req, res, next);

      // Assert: User pref used
      expect(res.locals.language).toBe('ja');
      expect(userServiceMock.getUserLanguagePreference).toHaveBeenCalledWith(1);
    });

    it('should parse Accept-Language header correctly', () => {
      // Arrange: Multiple languages with quality scores
      req.headers['accept-language'] = 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7';
      req.cookies = {}; // No cookie to override

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Should pick French (highest quality)
      expect(res.locals.language).toBe('fr');
    });

    it('should handle wildcard accept-language', () => {
      // Arrange
      req.headers['accept-language'] = '*';

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Should use default
      expect(res.locals.language).toBe('en');
    });

    it('should default to English if no preference detected', () => {
      // Arrange: No language hints
      req.headers = {};
      req.cookies = {};
      req.user = null;

      // Act
      middleware.detectLocale(req, res, next);

      // Assert
      expect(res.locals.language).toBe('en');
    });

    it('should handle malformed Accept-Language', () => {
      // Arrange
      req.headers['accept-language'] = 'totally-invalid-!!!';

      // Act & Assert: Should not crash
      expect(() => {
        middleware.detectLocale(req, res, next);
      }).not.toThrow();

      // Should fall back to default
      expect(res.locals.language).toBe('en');
    });
  });

  describe('Supported Language Validation', () => {
    it('should only apply supported languages', () => {
      // Arrange
      req.query = { lang: 'xx' }; // Unsupported language

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Should ignore and use default
      expect(res.locals.language).toBe('en');
    });

    it('should support language variants', () => {
      // Arrange: en-GB variant
      req.headers['accept-language'] = 'en-GB';

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Should accept variant
      expect(res.locals.language).toBe('en');
      expect(res.locals.variant).toBe('GB');
    });

    it('should list available languages in response headers', () => {
      // Arrange
      const expectedLanguages = ['en', 'es', 'fr', 'de', 'ja'];

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Should set header
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Available-Languages',
        expectedLanguages.join(', ')
      );
    });
  });

  describe('Language Switching', () => {
    it('should switch language via query parameter', () => {
      // Arrange
      req.query = { lang: 'es' };

      // Act
      middleware.detectLocale(req, res, next);

      // Assert
      expect(res.locals.language).toBe('es');
    });

    it('should persist language switch in cookie', () => {
      // Arrange
      req.query = { lang: 'fr' };

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Should set cookie
      expect(res.cookie).toHaveBeenCalledWith(
        'language',
        'fr',
        expect.objectContaining({
          path: '/',
          sameSite: 'lax',
        }),
      );
    });

    it('should persist language switch to user profile if authenticated', async () => {
      // Arrange
      req.user = { id: 1 };
      req.query = { lang: 'de' };

      // Act
      await middleware.detectLocale(req, res, next);

      // Assert: Should update user preference
      expect(userServiceMock.setUserLanguagePreference).toHaveBeenCalledWith(1, 'de');
    });

    it('should support POST /api/language endpoint', async () => {
      // Arrange: POST to change language
      req.method = 'POST';
      req.body = { language: 'ja' };
      req.user = { id: 1 };

      // Act
      const handler = middleware.handleLanguageSwitch();
      await handler(req, res);

      // Assert
      expect(userServiceMock.setUserLanguagePreference).toHaveBeenCalledWith(1, 'ja');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Fallback Language Behavior', () => {
    it('should use fallback language if primary language missing', async () => {
      // Arrange
      req.user = { id: 1 };
      req.query = { lang: 'es' };
      
      // User prefers Spanish with English fallback
      userServiceMock.getUserLanguagePreference.mockResolvedValueOnce({
        preferred: 'es',
        fallback: 'en',
      });

      // Act
      await middleware.detectLocale(req, res, next);

      // Assert
      expect(res.locals.primaryLanguage).toBe('es');
      expect(res.locals.fallbackLanguage).toBe('en');
    });

    it('should apply fallback when translation missing', async () => {
      // Arrange
      res.locals.language = 'de';
      res.locals.fallbackLanguage = 'en';

      // Act: Should be available for translation service
      const fallback = middleware.getFallbackLanguage(res);

      // Assert
      expect(fallback).toBe('en');
    });

    it('should respect user fallback preference', async () => {
      // Arrange
      req.user = { id: 1 };
      userServiceMock.getUserLanguagePreference.mockResolvedValueOnce({
        preferred: 'es',
        fallback: 'fr', // User wants French fallback, not English
      });

      // Act
      await middleware.detectLocale(req, res, next);

      // Assert
      expect(res.locals.fallbackLanguage).toBe('fr');
    });
  });

  describe('Response Localization', () => {
    it('should set Content-Language header', () => {
      // Arrange
      req.headers['accept-language'] = 'es';

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Browser understands response language
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Language',
        'es'
      );
    });

    it('should set locale in response locals for views/API', () => {
      // Arrange
      req.headers['accept-language'] = 'fr-FR';

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Available to downstream handlers
      expect(res.locals.language).toBe('fr');
      expect(res.locals.variant).toBe('FR');
    });

    it('should expose language list to templates/API', () => {
      // Arrange
      const expectedLanguages = ['en', 'es', 'fr', 'de', 'ja'];

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Available for language switcher UI
      expect(res.locals.availableLanguages).toEqual(expectedLanguages);
    });
  });

  describe('API Responses with Locale', () => {
    it('should return API response with language metadata', () => {
      // Arrange: API response handler
      const handler = middleware.localizedApiResponse();

      // Act
      const apiResponse = handler({
        data: { name: 'Product' },
        language: 'es',
      });

      // Assert
      expect(apiResponse.meta.language).toBe('es');
      expect(apiResponse.meta.timestamp).toBeDefined();
    });

    it('should support RTL languages in response headers', () => {
      // Arrange: Arabic is RTL
      req.query = { lang: 'ar' };

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Should provide RTL flag
      // (Header for frontend to set dir="rtl")
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Text-Direction',
        'rtl'
      );
    });
  });

  describe('Performance and Caching', () => {
    it('should cache language preference lookups', async () => {
      // Arrange
      req.user = { id: 1 };
      userServiceMock.getUserLanguagePreference.mockResolvedValueOnce('es');

      // Act: First request
      await middleware.detectLocale(req, res, next);
      // Second request (same user)
      req.user = { id: 1 };
      await middleware.detectLocale(req, res, next);

      // Assert: Should only query DB once (cached)
      expect(userServiceMock.getUserLanguagePreference).toHaveBeenCalledTimes(1);
    });

    it('should clear user language cache on preference change', async () => {
      // Arrange
      req.user = { id: 1 };
      userServiceMock.getUserLanguagePreference.mockResolvedValueOnce('es');
      await middleware.detectLocale(req, res, next);

      // Act: User changes preference
      req.body = { language: 'fr' };
      const switchHandler = middleware.handleLanguageSwitch();
      await switchHandler(req, res);

      // Now query again (should hit DB, not cache)
      userServiceMock.getUserLanguagePreference.mockResolvedValueOnce('fr');
      await middleware.detectLocale(req, res, next);

      // Assert: Should query DB again (cache invalidated)
      expect(userServiceMock.getUserLanguagePreference).toHaveBeenCalledTimes(2);
    });

    it('should warm language detection cache on startup', async () => {
      // Arrange: Common languages
      userServiceMock.getUserLanguagePreference.mockResolvedValue('en');

      // Act
      await middleware.warmCache(['en', 'es', 'fr', 'de', 'ja']);

      // Assert: Should preload common languages
      expect(middleware.getCacheSize()).toBeGreaterThan(0);
    });
  });

  describe('Multi-Tenant Language Support', () => {
    it('should support per-tenant language configurations', () => {
      // Arrange: Different tenants support different languages
      const tenant1Locale = new LocaleMiddleware(userServiceMock, {
        tenantId: 1,
        supportedLanguages: ['en', 'es', 'fr'],
      });
      const tenant2Locale = new LocaleMiddleware(userServiceMock, {
        tenantId: 2,
        supportedLanguages: ['en', 'ja', 'zh'],
      });

      // Act
      req.query = { lang: 'ja' };
      tenant1Locale.detectLocale(req, res, next);
      const tenant1Lang = res.locals.language;

      res.locals = {}; // Reset
      tenant2Locale.detectLocale(req, res, next);
      const tenant2Lang = res.locals.language;

      // Assert: Tenant 1 doesn't support Japanese
      expect(tenant1Lang).toBe('en'); // Falls back
      // Tenant 2 supports Japanese
      expect(tenant2Lang).toBe('ja');
    });

    it('should prevent language leakage between tenants', async () => {
      // Arrange: User in tenant 1 changes language
      req.user = { id: 1, tenantId: 1 };
      req.query = { lang: 'es' };

      // Act
      const handler = middleware.handleLanguageSwitch();
      await handler(req, res);

      // Assert: Should only update for this tenant
      expect(userServiceMock.setUserLanguagePreference).toHaveBeenCalledWith(
        1,
        'es',
        { tenantId: 1 } // Tenant isolation
      );
    });
  });

  describe('Security and Validation', () => {
    it('should prevent language parameter injection', () => {
      // Arrange: Malicious language code
      req.query = { lang: 'en"; DROP TABLE users; --' };

      // Act & Assert: Should not crash, should validate strictly
      expect(() => {
        middleware.detectLocale(req, res, next);
      }).not.toThrow();

      // Language should be ignored/default
      expect(res.locals.language).toBe('en'); // or default
    });

    it('should validate Accept-Language header strictly', () => {
      // Arrange: Malformed header
      req.headers['accept-language'] = 'en;;;,,, INVALID';

      // Act & Assert: Should parse safely
      expect(() => {
        middleware.detectLocale(req, res, next);
      }).not.toThrow();
    });

    it('should log language switch for audit trail', async () => {
      // Arrange
      req.user = { id: 1 };
      req.query = { lang: 'es' };
      const auditLogMock = jest.fn();
      const middlewareWithAudit = new LocaleMiddleware(userServiceMock, {
        onLanguageSwitch: auditLogMock,
      });

      // Act
      await middlewareWithAudit.detectLocale(req, res, next);

      // Assert: Audit log called
      expect(auditLogMock).toHaveBeenCalledWith({
        userId: 1,
        from: expect.any(String),
        to: 'es',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Browser Accept-Language Parsing', () => {
    it('should parse complex accept-language headers', () => {
      // Arrange: Real browser header
      req.headers['accept-language'] = 'en-US,en;q=0.9,es;q=0.8,ja;q=0.7,*;q=0.5';

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Should pick en-US (highest priority)
      expect(res.locals.language).toBe('en');
    });

    it('should handle edge case: no quality factor', () => {
      // Arrange: Simplified header
      req.headers['accept-language'] = 'de, fr, en';

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Should parse first as highest priority
      expect(res.locals.language).toBe('de');
    });

    it('should parse quality factor correctly', () => {
      // Arrange: Lower quality on preferred in header
      req.headers['accept-language'] = 'de;q=0.5, en;q=0.9, es;q=0.8';

      // Act
      middleware.detectLocale(req, res, next);

      // Assert: Should pick en (highest q value)
      expect(res.locals.language).toBe('en');
    });
  });
});
