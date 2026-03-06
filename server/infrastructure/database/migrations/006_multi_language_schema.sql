-- =====================================================
-- Migration: Add Multi-Language (i18n) Support
-- =====================================================
-- Date: 2026-03-02
-- Purpose: Add translation tables for product descriptions, categories, etc.

-- =====================================================
-- 1. CREATE SUPPORTED LANGUAGES TABLE
-- =====================================================
-- Manages which languages are supported by the platform
CREATE TABLE IF NOT EXISTS supported_languages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    language_code VARCHAR(5) UNIQUE NOT NULL,    -- e.g., 'en', 'es', 'fr', 'de', 'ja'
    language_name TEXT NOT NULL,                  -- e.g., 'English', 'Español'
    native_name TEXT NOT NULL,                    -- e.g., 'English', 'Español' in native language
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,             -- Default fallback language
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default languages
INSERT INTO supported_languages (language_code, language_name, native_name, is_active, is_default)
VALUES 
    ('en', 'English', 'English', true, true),
    ('es', 'Spanish', 'Español', true, false),
    ('fr', 'French', 'Français', true, false),
    ('de', 'German', 'Deutsch', true, false),
    ('ja', 'Japanese', '日本語', true, false)
ON CONFLICT (language_code) DO NOTHING;

-- =====================================================
-- 2. CREATE PRODUCT TRANSLATIONS TABLE
-- =====================================================
-- Stores localized product names and descriptions
CREATE TABLE IF NOT EXISTS product_translations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL REFERENCES supported_languages(language_code),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure one translation per product per language
    UNIQUE (product_id, language_code)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_product_translations_lookup
ON product_translations (product_id, language_code);

-- =====================================================
-- 3. CREATE CATEGORY TRANSLATIONS TABLE
-- =====================================================
-- Stores localized category names and descriptions
CREATE TABLE IF NOT EXISTS category_translations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL REFERENCES supported_languages(language_code),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure one translation per category per language
    UNIQUE (category_id, language_code)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_category_translations_lookup
ON category_translations (category_id, language_code);

-- =====================================================
-- 4. CREATE STATIC PAGE TRANSLATIONS TABLE
-- =====================================================
-- For translating static content like About, Terms, Privacy, etc.
CREATE TABLE IF NOT EXISTS static_page_translations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page_slug TEXT NOT NULL,                      -- e.g., 'about', 'terms', 'privacy'
    language_code VARCHAR(5) NOT NULL REFERENCES supported_languages(language_code),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    meta_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure one translation per page per language
    UNIQUE (page_slug, language_code)
);

CREATE INDEX IF NOT EXISTS idx_static_page_translations_lookup
ON static_page_translations (page_slug, language_code);

-- =====================================================
-- 5. CREATE USER LANGUAGE PREFERENCE TABLE
-- =====================================================
-- Stores user's preferred language(s) with fallback chain
CREATE TABLE IF NOT EXISTS user_language_preferences (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferred_language VARCHAR(5) NOT NULL REFERENCES supported_languages(language_code),
    fallback_language VARCHAR(5) REFERENCES supported_languages(language_code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_user_language_preferences
ON user_language_preferences (user_id);

-- =====================================================
-- 6. CREATE TRANSLATION AUDIT TABLE
-- =====================================================
-- Track who translated what and when (important for multi-tenant isolation)
CREATE TABLE IF NOT EXISTS translation_audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    translator_id BIGINT NOT NULL REFERENCES users(id),
    entity_type VARCHAR(50) NOT NULL,            -- 'product', 'category', 'static_page'
    entity_id BIGINT NOT NULL,
    language_code VARCHAR(5) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    action VARCHAR(50) NOT NULL,                 -- 'create', 'update', 'delete'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_translation_audit_translator
ON translation_audit_log (translator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_translation_audit_entity
ON translation_audit_log (entity_type, entity_id);

-- =====================================================
-- 7. MODIFY PRODUCTS TABLE FOR TRANSLATION SUPPORT
-- =====================================================
-- Add columns to track translation status
ALTER TABLE products
ADD COLUMN IF NOT EXISTS default_language VARCHAR(5) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS is_translatable BOOLEAN DEFAULT true;

-- =====================================================
-- 8. CREATE TRANSLATION TEMPLATE TABLE
-- =====================================================
-- For managing translation strings that appear in multiple places
CREATE TABLE IF NOT EXISTS translation_strings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    string_key TEXT UNIQUE NOT NULL,             -- e.g., 'btn.add_to_cart', 'error.product_not_found'
    context TEXT,                                 -- Where this string is used
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS translation_string_values (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    string_id BIGINT NOT NULL REFERENCES translation_strings(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL REFERENCES supported_languages(language_code),
    translated_value TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (string_id, language_code)
);

-- =====================================================
-- 9. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_supported_languages_active
ON supported_languages (is_active);

CREATE INDEX IF NOT EXISTS idx_translation_strings_key
ON translation_strings (string_key);

CREATE INDEX IF NOT EXISTS idx_translation_string_values_lookup
ON translation_string_values (string_id, language_code);

-- =====================================================
-- Migration Status
-- =====================================================
-- Status: READY FOR TESTING
-- Next: Write failing tests for i18n functionality
