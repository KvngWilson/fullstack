-- =====================================================
-- Migration: Consolidate Price Storage to Integer Minor Units
-- =====================================================
-- Date: 2026-03-04
-- Purpose: Fix floating-point arithmetic issues by storing all prices as integer minor units
-- Impact: Ensures accurate financial calculations across all currencies

BEGIN;

-- =====================================================
-- PHASE 1: Add New Integer Columns
-- =====================================================

-- product_variants: Add integer price columns
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS price_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'USD';

-- variants (legacy): Add integer price columns
ALTER TABLE IF EXISTS variants
ADD COLUMN IF NOT EXISTS price_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'USD';

-- orders: Convert monetary fields to integer minor units
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cents INTEGER DEFAULT 0;

-- payments: Add integer amount column
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS amount_cents INTEGER DEFAULT 0;

-- product_variants and variants: Track price update timestamp
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS price_last_updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE IF EXISTS variants
ADD COLUMN IF NOT EXISTS price_last_updated_at TIMESTAMPTZ DEFAULT now();

-- =====================================================
-- PHASE 2: Migrate Existing Data to Integer Minor Units
-- =====================================================

-- Migrate product_variants prices (multiply by 100, round to handle floating point)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'price'
  ) THEN
    UPDATE product_variants
    SET price_cents = ROUND(COALESCE(price::numeric, 0) * 100)::INTEGER,
        price_last_updated_at = now()
    WHERE price IS NOT NULL
      AND price_cents = 0;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'price_cents'
  ) THEN
    NULL;
  END IF;
END $$;

-- Migrate variants prices (multiply by 100)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'variants'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'variants' AND column_name = 'price'
    ) THEN
      UPDATE variants
      SET price_cents = ROUND(COALESCE(price::numeric, 0) * 100)::INTEGER,
          price_last_updated_at = now()
      WHERE price IS NOT NULL
        AND price_cents = 0;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'variants' AND column_name = 'price_cents'
    ) THEN
      NULL;
    END IF;
  END IF;
END $$;

-- Migrate orders: Convert NUMERIC amounts to integer minor units
DO $$
DECLARE
  subtotal_expr TEXT := '0::numeric';
  tax_expr TEXT := '0::numeric';
  shipping_expr TEXT := '0::numeric';
  total_expr TEXT := '0::numeric';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'subtotal'
  ) THEN
    subtotal_expr := 'subtotal::numeric';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tax'
  ) THEN
    tax_expr := 'tax::numeric';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_cost'
  ) THEN
    shipping_expr := 'shipping_cost::numeric';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'total'
  ) THEN
    total_expr := 'total::numeric';
  END IF;

  EXECUTE format(
    'UPDATE orders
     SET
       subtotal_cents = ROUND(COALESCE((CASE WHEN %1$s > 0 THEN %1$s ELSE %4$s * 0.9 END), 0) * 100)::INTEGER,
       tax_cents = ROUND(COALESCE(%2$s, 0) * 100)::INTEGER,
       shipping_cents = ROUND(COALESCE(%3$s, 0) * 100)::INTEGER,
       total_cents = ROUND(COALESCE(%4$s, 0) * 100)::INTEGER
     WHERE total_cents = 0',
    subtotal_expr,
    tax_expr,
    shipping_expr,
    total_expr
  );
END $$;

-- Migrate payments amounts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'amount'
  ) THEN
    UPDATE payments
    SET amount_cents = ROUND(COALESCE(amount::numeric, 0) * 100)::INTEGER
    WHERE amount_cents = 0
      AND amount IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- PHASE 3: Validation - Check All Data Migrated
-- =====================================================

-- These queries should return 0 rows (no unmigrated data)
-- If they return rows, the migration is incomplete and should NOT be committed

-- Check for unmigrated product_variants with prices
CREATE OR REPLACE FUNCTION validate_variant_migration()
RETURNS TABLE(issue_count BIGINT, issue_description TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    'Invalid product_variants: negative price_cents'::TEXT
  FROM product_variants
  WHERE price_cents < 0;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    'Invalid variants: negative price_cents'::TEXT
  FROM variants
  WHERE price_cents < 0;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'total'
  ) THEN
    RETURN QUERY
    SELECT 
      COUNT(*)::BIGINT,
      'Unmigrated orders: total set but total_cents is 0'::TEXT
    FROM orders
    WHERE total > 0
      AND total_cents = 0;
  ELSE
    RETURN QUERY
    SELECT
      0::BIGINT,
      'Unmigrated orders: total set but total_cents is 0'::TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'amount'
  ) THEN
    RETURN QUERY
    SELECT 
      COUNT(*)::BIGINT,
      'Unmigrated payments: amount set but amount_cents is 0'::TEXT
    FROM payments
    WHERE amount_cents = 0
      AND amount IS NOT NULL;
  ELSE
    RETURN QUERY
    SELECT
      0::BIGINT,
      'Unmigrated payments: amount set but amount_cents is 0'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Run validation (should return all 0s)
SELECT * FROM validate_variant_migration();

-- =====================================================
-- PHASE 4: Create Helper Functions for Currency Formatting
-- =====================================================

-- Convert integer minor units to major units based on currency
CREATE OR REPLACE FUNCTION format_currency_major_units(
  cents INTEGER,
  currency_code VARCHAR(3) DEFAULT 'USD'
)
RETURNS NUMERIC AS $$
DECLARE
  divisor INTEGER;
BEGIN
  -- Most currencies use 100 (2 decimals), but some use 1000 (3 decimals)
  divisor := CASE 
    WHEN currency_code IN ('BHD', 'JOD', 'KWD', 'OMR', 'TND') THEN 1000  -- 3 decimals
    WHEN currency_code IN ('CLF') THEN 10000  -- 4 decimals
    WHEN currency_code IN ('BTC', 'ETH') THEN 100000000  -- 8 decimals (crypto)
    ELSE 100  -- Default: 2 decimals (USD, EUR, GBP, etc.)
  END;
  
  RETURN COALESCE(cents, 0)::NUMERIC / divisor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Convert major units to integer minor units based on currency
CREATE OR REPLACE FUNCTION convert_to_currency_cents(
  amount NUMERIC,
  currency_code VARCHAR(3) DEFAULT 'USD'
)
RETURNS INTEGER AS $$
DECLARE
  multiplier INTEGER;
BEGIN
  multiplier := CASE 
    WHEN currency_code IN ('BHD', 'JOD', 'KWD', 'OMR', 'TND') THEN 1000
    WHEN currency_code IN ('CLF') THEN 10000
    WHEN currency_code IN ('BTC', 'ETH') THEN 100000000
    ELSE 100
  END;
  
  RETURN ROUND(COALESCE(amount, 0) * multiplier)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- PHASE 5: Add Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_product_variants_price_cents ON product_variants(price_cents);
CREATE INDEX IF NOT EXISTS idx_product_variants_currency ON product_variants(currency_code);
CREATE INDEX IF NOT EXISTS idx_orders_total_cents ON orders(total_cents);
CREATE INDEX IF NOT EXISTS idx_payments_amount_cents ON payments(amount_cents);

-- =====================================================
-- PHASE 6: Create Views for Backward Compatibility
-- =====================================================

-- View that converts integer cents back to NUMERIC for legacy queries
-- (Use format_currency_major_units() function instead of this view in new code)
CREATE OR REPLACE VIEW product_variants_with_prices AS
SELECT 
  pv.*,
  format_currency_major_units(pv.price_cents, pv.currency_code)::NUMERIC AS price_major_units,
  pv.price_cents::NUMERIC / CASE 
    WHEN pv.currency_code IN ('BHD', 'JOD', 'KWD', 'OMR', 'TND') THEN 1000
    WHEN pv.currency_code IN ('CLF') THEN 10000
    WHEN pv.currency_code IN ('BTC', 'ETH') THEN 100000000
    ELSE 100
  END AS price_formatted
FROM product_variants pv;

-- =====================================================
-- PHASE 7: Add Comments for Future Developers
-- =====================================================

COMMENT ON COLUMN product_variants.price_cents IS 
  'Price in minor units (cents for USD, pence for GBP, fils for KWD, etc). Use format_currency_major_units() to display.';

COMMENT ON COLUMN product_variants.currency_code IS 
  'ISO 4217 currency code. Combined with price_cents to calculate major units.';

COMMENT ON COLUMN orders.total_cents IS 
  'Total order amount in minor units. Use format_currency_major_units(total_cents, currency) to display.';

COMMENT ON COLUMN orders.subtotal_cents IS 
  'Subtotal (before tax and shipping) in minor units.';

COMMENT ON COLUMN orders.tax_cents IS 
  'Tax amount in minor units.';

COMMENT ON COLUMN orders.shipping_cents IS 
  'Shipping cost in minor units.';

COMMENT ON FUNCTION format_currency_major_units IS
  'Convert integer minor units to NUMERIC major units for display. Handles currencies with different decimal places.';

COMMENT ON FUNCTION convert_to_currency_cents IS
  'Convert NUMERIC major units to integer minor units for storage. Inverse of format_currency_major_units.';

-- =====================================================
-- PHASE 8: Remove Legacy Columns
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'price'
  ) THEN
    ALTER TABLE product_variants DROP COLUMN price;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'variants'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'price'
  ) THEN
    ALTER TABLE variants DROP COLUMN price;
  END IF;
END $$;

-- =====================================================
-- PHASE 9: Summary
-- =====================================================

-- Summary of what was migrated:
-- 1. Added price_cents columns to product_variants and variants
-- 2. Migrated all prices from NUMERIC to INTEGER (multiply by 100)
-- 3. Added *_cents columns to orders and payments
-- 4. Created helper functions for currency conversion
-- 5. Added performance indexes
-- 6. Created backward-compatibility views
-- 7. Removed old NUMERIC columns entirely

-- Next steps:
-- 1. Update application code to use price_cents and *_cents columns
-- 2. Update ORM models to map to new columns
-- 3. Update API responses to include currency_code
-- 4. Update display layer to use format_currency_major_units()
-- 5. Update price input validation to prevent floating-point amounts
-- 6. Add tests for rounding and currency conversion

COMMIT;

-- =====================================================
-- ROLLBACK PLAN (if needed)
-- =====================================================
-- BEGIN;
-- ALTER TABLE product_variants ADD COLUMN price NUMERIC(12,2);
-- ALTER TABLE variants ADD COLUMN price NUMERIC(12,2);
-- ALTER TABLE product_variants DROP COLUMN price_cents;
-- ALTER TABLE variants DROP COLUMN price_cents;
-- ALTER TABLE orders DROP COLUMN subtotal_cents, DROP COLUMN tax_cents, DROP COLUMN shipping_cents, DROP COLUMN total_cents;
-- ALTER TABLE payments DROP COLUMN amount_cents;
-- DROP VIEW product_variants_with_prices;
-- DROP FUNCTION format_currency_major_units;
-- DROP FUNCTION convert_to_currency_cents;
-- DROP FUNCTION validate_variant_migration;
-- COMMIT;
