-- Migration 017: Standardize Currency Fields
-- Date: February 2026
--
-- Data Consistency Fix: Standardize currency field types and add validation
--
-- Problem: Currency fields have inconsistent types and constraints:
--   - orders.currency: CHAR(3)
--   - product_variants.currency_code: VARCHAR(3)
--   - payments.currency: VARCHAR(10) (too large, should be 3)
--
-- Solution: Standardize to VARCHAR(3) with ISO 4217 validation constraint

BEGIN;

-- ============================================
-- 1. Standardize payments.currency
-- ============================================

-- Change type from VARCHAR(10) to VARCHAR(3)
ALTER TABLE payments
  ALTER COLUMN currency TYPE VARCHAR(3);

-- Ensure NOT NULL
ALTER TABLE payments
  ALTER COLUMN currency SET NOT NULL;

-- ============================================
-- 2. Add Validation Constraints
-- ============================================

-- Check constraints ensure ISO 4217 3-letter code format
-- Pattern: ^[A-Z]{3}$ (exactly 3 uppercase letters)

ALTER TABLE orders
  ADD CONSTRAINT orders_currency_valid
  CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_currency_valid
  CHECK (currency_code ~ '^[A-Z]{3}$');

ALTER TABLE payments
  ADD CONSTRAINT payments_currency_valid
  CHECK (currency ~ '^[A-Z]{3}$');

-- ============================================
-- 3. Create Indices for Currency Queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_currency
  ON orders(currency)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_variants_currency
  ON product_variants(currency_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_currency
  ON payments(currency);

-- ============================================
-- 4. Verify Consistency
-- ============================================

DO $$
DECLARE
  v_orders_count INT;
  v_orders_valid INT;
  v_variants_count INT;
  v_variants_valid INT;
  v_payments_count INT;
  v_payments_valid INT;
BEGIN
  -- Verify orders currencies
  SELECT COUNT(*) INTO v_orders_count FROM orders;
  SELECT COUNT(*) INTO v_orders_valid FROM orders WHERE currency ~ '^[A-Z]{3}$';

  RAISE NOTICE 'Currency Standardization Verification:';
  RAISE NOTICE '';
  RAISE NOTICE 'Orders:';
  RAISE NOTICE '  Total: %', v_orders_count;
  RAISE NOTICE '  Valid (ISO 4217): %', v_orders_valid;

  IF v_orders_count > 0 AND v_orders_valid < v_orders_count THEN
    RAISE WARNING '  ✗ Invalid orders currencies found';
    RAISE NOTICE '    Sample invalid values:';
    RAISE NOTICE '    %', (SELECT string_agg(DISTINCT currency, ', ') FROM orders WHERE currency !~ '^[A-Z]{3}$');
  ELSE
    RAISE NOTICE '  ✓ All orders have valid currencies';
  END IF;

  -- Verify product variants currencies
  SELECT COUNT(*) INTO v_variants_count FROM product_variants;
  SELECT COUNT(*) INTO v_variants_valid FROM product_variants WHERE currency_code ~ '^[A-Z]{3}$';

  RAISE NOTICE '';
  RAISE NOTICE 'Product Variants:';
  RAISE NOTICE '  Total: %', v_variants_count;
  RAISE NOTICE '  Valid (ISO 4217): %', v_variants_valid;

  IF v_variants_count > 0 AND v_variants_valid < v_variants_count THEN
    RAISE WARNING '  ✗ Invalid product variant currencies found';
    RAISE NOTICE '    Sample invalid values:';
    RAISE NOTICE '    %', (SELECT string_agg(DISTINCT currency_code, ', ') FROM product_variants WHERE currency_code !~ '^[A-Z]{3}$');
  ELSE
    RAISE NOTICE '  ✓ All product variants have valid currencies';
  END IF;

  -- Verify payments currencies
  SELECT COUNT(*) INTO v_payments_count FROM payments;
  SELECT COUNT(*) INTO v_payments_valid FROM payments WHERE currency ~ '^[A-Z]{3}$';

  RAISE NOTICE '';
  RAISE NOTICE 'Payments:';
  RAISE NOTICE '  Total: %', v_payments_count;
  RAISE NOTICE '  Valid (ISO 4217): %', v_payments_valid;

  IF v_payments_count > 0 AND v_payments_valid < v_payments_count THEN
    RAISE WARNING '  ✗ Invalid payments currencies found';
    RAISE NOTICE '    Sample invalid values:';
    RAISE NOTICE '    %', (SELECT string_agg(DISTINCT currency, ', ') FROM payments WHERE currency !~ '^[A-Z]{3}$');
  ELSE
    RAISE NOTICE '  ✓ All payments have valid currencies';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Currency Standardization: COMPLETE';
END $$;

-- ============================================
-- 5. Document Supported Currencies
-- ============================================

CREATE TABLE IF NOT EXISTS supported_currencies (
  code VARCHAR(3) PRIMARY KEY,
  name TEXT NOT NULL,
  symbol VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE supported_currencies IS
  'List of ISO 4217 currency codes supported by the platform';

-- ============================================
-- Usage Notes
-- ============================================
--
-- All currency fields now:
-- - Use VARCHAR(3) type
-- - Require ISO 4217 format: exactly 3 uppercase letters
-- - Are indexed for query performance
-- - Support multi-currency operations
--
-- Common ISO 4217 codes:
--   USD - US Dollar
--   EUR - Euro
--   GBP - British Pound
--   JPY - Japanese Yen
--   CAD - Canadian Dollar
--   AUD - Australian Dollar
--   etc.

COMMIT;
