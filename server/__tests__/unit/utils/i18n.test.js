/**
 * Multi-Language (i18n) Backend Tests
 * Requirements:
 * - Language switcher updates UI
 * - API returns localized content
 * - Product descriptions localized
 * - Fallback language behavior
 * - Admin can manage translations
 */

const TranslationService = require("../../../../server/domain/i18n/services/TranslationService");
// const LocaleMiddleware = require('../../../../server/api/middleware/locale.middleware');
const { pool } = require("../../../../server/config/db");

describe("Translation Service - Unit Tests", () => {
  let translationService;
  let dbPoolMock;

  beforeEach(() => {
    dbPoolMock = {
      query: jest.fn(),
    };
    translationService = new TranslationService(dbPoolMock);
    jest
      .spyOn(translationService, "validatePermission")
      .mockResolvedValue(true);
  });

  describe("getProductTranslation", () => {
    it("should return translated product name and description", async () => {
      // Arrange
      const productId = 1;
      const languageCode = "es";

      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            product_id: productId,
            language_code: languageCode,
            name: "Laptop Gaming",
            description: "Portátil de alto rendimiento",
          },
        ],
      });

      // Act
      const translation = await translationService.getProductTranslation(
        productId,
        languageCode,
      );

      // Assert
      expect(translation.name).toBe("Laptop Gaming");
      expect(translation.description).toBe("Portátil de alto rendimiento");
      expect(translation.language_code).toBe("es");
    });

    it("should fallback to default language if translation missing", async () => {
      // Arrange: No Spanish translation exists
      dbPoolMock.query
        .mockResolvedValueOnce({ rows: [] }) // Spanish missing
        .mockResolvedValueOnce({
          // Fallback to English
          rows: [
            {
              name: "Gaming Laptop",
              description: "High-performance laptop",
            },
          ],
        });

      // Act
      const translation = await translationService.getProductTranslation(
        1,
        "es", // Request Spanish
      );

      // Assert: Should fallback
      expect(translation.name).toBe("Gaming Laptop");
    });

    it("should cache translations in memory", async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ name: "Laptop", language_code: "es" }],
      });

      // Act: First call hits DB
      await translationService.getProductTranslation(1, "es");
      // Second call should use cache
      await translationService.getProductTranslation(1, "es");

      // Assert: DB should only be called once
      expect(dbPoolMock.query).toHaveBeenCalledTimes(1);
    });

    it("should invalidate cache when translation updated", async () => {
      // Arrange: Pre-cached translation
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: "Old Name", language_code: "es", product_id: 1 }],
      });
      await translationService.getProductTranslation(1, "es");

      // Act: Update translation (requires adminId=1)
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ id: 100 }],
      });

      await translationService.updateProductTranslation(
        1,
        "es",
        {
          name: "New Name",
        },
        1,
      );

      // Fetch again should hit DB
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: "New Name", language_code: "es", product_id: 1 }],
      });
      const updated = await translationService.getProductTranslation(1, "es");

      // Assert
      expect(updated.name).toBe("New Name");
    });

    it("should throw on invalid product ID", async () => {
      // Act & Assert
      expect(async () => {
        await translationService.getProductTranslation(null, "en");
      }).rejects.toThrow();

      expect(async () => {
        await translationService.getProductTranslation(-1, "en");
      }).rejects.toThrow();
    });

    it("should throw on invalid language code", async () => {
      // Act & Assert
      expect(async () => {
        await translationService.getProductTranslation(1, "invalid");
      }).rejects.toThrow();

      expect(async () => {
        await translationService.getProductTranslation(1, "");
      }).rejects.toThrow();
    });
  });

  describe("getCategoryTranslation", () => {
    it("should return translated category name", async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            category_id: 1,
            language_code: "fr",
            name: "Électronique",
            description: "Produits électroniques",
          },
        ],
      });

      // Act
      const translation = await translationService.getCategoryTranslation(
        1,
        "fr",
      );

      // Assert
      expect(translation.name).toBe("Électronique");
      expect(translation.language_code).toBe("fr");
    });

    it("should handle category translation for hierarchy", async () => {
      // Categories can be nested: Electronics > Phones > Accessories
      // Translations should work at each level
      dbPoolMock.query
        .mockResolvedValueOnce({
          rows: [
            {
              name: "Teléfono",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              name: "Accesorios",
            },
          ],
        });

      // Act
      const phone = await translationService.getCategoryTranslation(2, "es");
      const accessories = await translationService.getCategoryTranslation(
        3,
        "es",
      );

      // Assert
      expect(phone.name).toBe("Teléfono");
      expect(accessories.name).toBe("Accesorios");
    });
  });

  describe("getStaticPageTranslation", () => {
    it("should return translated page content", async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          {
            page_slug: "about",
            language_code: "de",
            title: "Über Uns",
            content: "Wir sind ein E-Commerce-Unternehmen...",
            meta_description: "Mehr über uns erfahren",
          },
        ],
      });

      // Act
      const translation = await translationService.getStaticPageTranslation(
        "about",
        "de",
      );

      // Assert
      expect(translation.title).toBe("Über Uns");
      expect(translation.content).toContain("E-Commerce");
    });

    it("should support multiple static pages with fallbacks", async () => {
      // Act & Assert: about, terms, privacy, contact all translatable
      const pages = ["about", "terms", "privacy", "contact"];

      // Mock responses for each page (Spanish not found, fallback to English)
      for (const page of pages) {
        dbPoolMock.query
          .mockResolvedValueOnce({ rows: [] }) // Spanish missing
          .mockResolvedValueOnce({
            rows: [
              {
                page_slug: page,
                language_code: "en",
                title: `${page} EN`,
                content: `Content for ${page}`,
              },
            ],
          }); // Fallback English
      }

      for (const page of pages) {
        // Should not throw for any page
        const result = await translationService.getStaticPageTranslation(
          page,
          "es",
        );
        expect(result).toBeDefined();
      }
    });
  });

  describe("updateProductTranslation (Admin)", () => {
    it("should allow admin to update translation", async () => {
      // Arrange
      const adminId = 1; // Admin user
      const updateData = {
        name: "Updated Name",
        description: "Updated description",
      };

      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });

      // Act
      await translationService.updateProductTranslation(
        1, // product ID
        "es", // language
        updateData,
        adminId,
      );

      // Assert: Audit log should be created
      expect(dbPoolMock.query).toHaveBeenCalledWith(
        expect.stringContaining("translation_audit_log"),
        expect.any(Array),
      );
    });

    it("should reject non-admin updates", async () => {
      // Arrange
      const customerId = 999; // Regular user
      const updateData = { name: "Hacked!" };
      translationService.validatePermission.mockRejectedValueOnce(
        new Error("Unauthorized"),
      );

      // Act & Assert
      expect(async () => {
        await translationService.updateProductTranslation(
          1,
          "es",
          updateData,
          customerId,
        );
      }).rejects.toThrow("Unauthorized");
    });

    it("should create audit trail for all translations", async () => {
      // Arrange
      const translateData = { name: "New", description: "Content" };

      // Mock update and audit log
      dbPoolMock.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 100 }] }); // Audit log

      // Act
      await translationService.updateProductTranslation(
        1,
        "es",
        translateData,
        1,
      );

      // Assert: Both update and audit log queries
      expect(dbPoolMock.query).toHaveBeenCalledTimes(2);
    });

    it("should prevent duplicate translations", async () => {
      // Arrange: Translation already exists
      dbPoolMock.query.mockRejectedValueOnce({
        code: "23505", // PostgreSQL unique violation
      });

      // Act & Assert
      expect(async () => {
        await translationService.updateProductTranslation(
          1,
          "es",
          { name: "Duplicate" },
          1,
        );
      }).rejects.toThrow("Translation already exists");
    });
  });

  describe("Batch Translation Operations", () => {
    it("should get all translations for a product", async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          { language_code: "en", name: "Laptop", description: "A laptop" },
          { language_code: "es", name: "Portátil", description: "Un portátil" },
          {
            language_code: "fr",
            name: "Ordinateur",
            description: "Un ordinateur",
          },
        ],
      });

      // Act
      const translations =
        await translationService.getAllProductTranslations(1);

      // Assert
      expect(translations.length).toBe(3);
      expect(translations.map((t) => t.language_code)).toEqual([
        "en",
        "es",
        "fr",
      ]);
    });

    it("should bulk update translations for multiple products", async () => {
      // Arrange: Update multiple categories in Spanish
      const updates = [
        { categoryId: 1, name: "Electrónica" },
        { categoryId: 2, name: "Ropa" },
        { categoryId: 3, name: "Libros" },
      ];

      // Reset mock before setting up new responses
      dbPoolMock.query.mockClear();

      // Mock inserts + audit logs for three category updates
      dbPoolMock.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] });

      // Act
      await translationService.bulkUpdateTranslations(
        "category",
        "es",
        updates,
        1,
      );

      // Assert: Should execute insert + audit log per update
      expect(dbPoolMock.query).toHaveBeenCalledTimes(6);
    });

    it("should handle partial failures in bulk operations gracefully", async () => {
      // Arrange: Some updates succeed, some fail
      // First success, then failure, then success = 3 query attempts
      dbPoolMock.query.mockClear();

      dbPoolMock.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Product 1 insert
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Product 1 audit
        .mockRejectedValueOnce(new Error("Bad data")) // Product 2 insert fails
        .mockResolvedValueOnce({ rows: [{ id: 3 }] }) // Product 3 insert
        .mockResolvedValueOnce({ rows: [{ id: 3 }] }); // Product 3 audit

      // Act
      const results = await translationService.bulkUpdateTranslations(
        "product",
        "es",
        [
          { productId: 1, name: "OK", description: "OK" },
          { productId: 2, name: "FAIL", description: "FAIL" },
          { productId: 3, name: "OK", description: "OK" },
        ],
        1,
      );

      // Assert: Should return mixed results
      expect(results.successful).toBe(2);
      expect(results.failed).toBe(1);
      expect(results.errors.length).toBe(1);
    });
  });

  describe("Language Management", () => {
    it("should list supported languages", async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          { language_code: "en", language_name: "English", is_active: true },
          { language_code: "es", language_name: "Spanish", is_active: true },
          { language_code: "fr", language_name: "French", is_active: true },
          { language_code: "de", language_name: "German", is_active: false },
        ],
      });

      // Act
      const languages = await translationService.getSupportedLanguages();

      // Assert
      expect(languages.length).toBe(4);
      expect(languages.filter((l) => l.is_active).length).toBe(3);
    });

    it("should add new language support", async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ language_code: "ja" }],
      });

      // Act
      await translationService.addLanguageSupport("ja", "Japanese", "日本語");

      // Assert
      expect(dbPoolMock.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO supported_languages"),
        expect.any(Array),
      );
    });

    it("should get default language for fallback", async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ language_code: "en", is_default: true }],
      });

      // Act
      const defaultLang = await translationService.getDefaultLanguage();

      // Assert
      expect(defaultLang.language_code).toBe("en");
      expect(defaultLang.is_default).toBe(true);
    });
  });

  describe("Translation String Management", () => {
    it("should get translation string by key", async () => {
      // Arrange: Translation strings used in UI
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          { language_code: "en", translated_value: "Add to Cart" },
          { language_code: "es", translated_value: "Añadir al Carrito" },
          { language_code: "fr", translated_value: "Ajouter au Panier" },
        ],
      });

      // Act
      const strings =
        await translationService.getTranslationStringByKey("btn.add_to_cart");

      // Assert
      expect(strings.length).toBe(3);
      expect(
        strings.find((s) => s.language_code === "es").translated_value,
      ).toBe("Añadir al Carrito");
    });

    it("should handle missing translation string gracefully", async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [], // String not found
      });

      // Act
      const strings =
        await translationService.getTranslationStringByKey("missing.key");

      // Assert: Should return empty or key itself
      expect(strings.length).toBe(0);
    });
  });

  describe("Performance and Caching", () => {
    it("should cache translations for configured time", async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ name: "Cached Product" }],
      });

      // Act: First call
      const result1 = await translationService.getProductTranslation(1, "es");
      // Second call should return cached
      const result2 = await translationService.getProductTranslation(1, "es");

      // Assert
      expect(result1).toBe(result2); // Same object (cached)
      expect(dbPoolMock.query).toHaveBeenCalledTimes(1);
    });

    it("should clear cache after expire time", async () => {
      // Arrange: Short TTL for testing
      const ttl = 100; // 100ms
      const service = new TranslationService(dbPoolMock, { cacheTTL: ttl });

      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ name: "Product" }],
      });

      // Act: First call
      await service.getProductTranslation(1, "es");

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, ttl + 50));

      // Second call after expiry
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ name: "Product" }],
      });
      await service.getProductTranslation(1, "es");

      // Assert: DB called twice (cache expired)
      expect(dbPoolMock.query).toHaveBeenCalledTimes(2);
    });

    it("should warm cache on application startup", async () => {
      // Arrange: Common translations to preload
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            product_id: 1,
            language_code: "es",
            name: "Laptop",
            description: "A computer",
          },
          {
            id: 2,
            product_id: 2,
            language_code: "es",
            name: "Phone",
            description: "A phone",
          },
        ],
      });

      // Act
      await translationService.warmCache("es");

      // Assert: Cache populated
      expect(translationService.getCacheSize()).toBeGreaterThan(0);
    });
  });

  describe("Security and Multi-Tenant Isolation", () => {
    it("should isolate translations by tenant (if multi-tenant)", async () => {
      // Arrange: Different translations per tenant
      dbPoolMock.query
        .mockResolvedValueOnce({
          rows: [
            {
              tenant_id: 1,
              product_id: 1,
              language_code: "es",
              name: "Producto",
              description: "Spanish product",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              tenant_id: 2,
              product_id: 1,
              language_code: "es",
              name: "Artículo",
              description: "Spanish item",
            },
          ], // Different term for tenant 2
        });

      // Act: Tenant 1 and Tenant 2 see different translations
      const t1 = await translationService.getProductTranslation(1, "es", {
        tenantId: 1,
      });
      const t2 = await translationService.getProductTranslation(1, "es", {
        tenantId: 2,
      });

      // Assert
      expect(t1.name).not.toBe(t2.name);
      expect(t1.name).toBe("Producto");
      expect(t2.name).toBe("Artículo");
    });

    it("should prevent SQL injection in translation queries", async () => {
      // Arrange: Malicious language code
      const maliciousCode = "'; DROP TABLE products; --";

      // Act & Assert: Should be caught during validation
      expect(async () => {
        await translationService.getProductTranslation(1, maliciousCode);
      }).rejects.toThrow();
    });

    it("should log all translation modifications", async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValue({ rows: [{ id: 1 }] });

      // Act
      await translationService.updateProductTranslation(
        1,
        "es",
        { name: "Updated" },
        1,
      );

      // Assert: Audit log created
      expect(dbPoolMock.query).toHaveBeenCalledWith(
        expect.stringContaining("translation_audit_log"),
        expect.any(Array),
      );
    });
  });
});
