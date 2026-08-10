-- Migration 016: Standardize Payment Status Enum
-- Date: February 2026
--
-- Data Consistency Fix: Migrate payments table from payment_status to payment_status_v2
--
-- Problem: payments table uses payment_status enum with values:
--   pending, succeeded, success, failed, refunded
-- But orders table uses payment_status_v2 with values:
--   pending, authorized, captured, failed, refunded
--
-- This inconsistency causes confusion and makes queries across tables difficult.
--
-- Solution: Standardize to payment_status_v2 with value mapping:
--   pending → pending
--   succeeded/success → captured
--   failed → failed
--   refunded → refunded

BEGIN;

-- ============================================
-- 1. Create Backup Column (Safety)
-- ============================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS status_old payment_status;

-- ============================================
-- 2. Backup Current Status Values
-- ============================================

UPDATE payments
  SET status_old = status
  WHERE status_old IS NULL;

-- ============================================
-- 3. Add New Status Column (payment_status_v2)
-- ============================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS status_v2 payment_status_v2;

-- ============================================
-- 4. Migrate Data with Mapping Logic
-- ============================================

UPDATE payments
SET status_v2 = CASE
  WHEN status_old::text = 'pending' THEN 'pending'::payment_status_v2
  WHEN status_old::text IN ('succeeded', 'success') THEN 'captured'::payment_status_v2
  WHEN status_old::text = 'failed' THEN 'failed'::payment_status_v2
  WHEN status_old::text = 'refunded' THEN 'refunded'::payment_status_v2
  ELSE 'pending'::payment_status_v2
END
WHERE status_v2 IS NULL;

-- ============================================
-- 5. Verify Migration
-- ============================================

DO $$
DECLARE
  v_total_payments INT;
  v_migrated_payments INT;
  v_null_status_v2 INT;
BEGIN
  SELECT COUNT(*) INTO v_total_payments FROM payments;
  SELECT COUNT(*) INTO v_migrated_payments FROM payments WHERE status_v2 IS NOT NULL;
  SELECT COUNT(*) INTO v_null_status_v2 FROM payments WHERE status_v2 IS NULL;

  RAISE NOTICE 'Payment Status Migration Report:';
  RAISE NOTICE '  Total payments: %', v_total_payments;
  RAISE NOTICE '  Migrated to status_v2: %', v_migrated_payments;
  RAISE NOTICE '  NULL status_v2: %', v_null_status_v2;

  IF v_null_status_v2 > 0 THEN
    RAISE EXCEPTION 'Migration failed: % payments have NULL status_v2', v_null_status_v2;
  END IF;

  RAISE NOTICE 'Payment status values:';
  RAISE NOTICE '%', (SELECT string_agg(DISTINCT status_v2::text, ', ' ORDER BY status_v2::text) FROM payments);
END $$;

-- ============================================
-- 6. Make status_v2 NOT NULL and rename
-- ============================================

ALTER TABLE payments
  ALTER COLUMN status_v2 SET NOT NULL;

-- Drop old status column
ALTER TABLE payments
  DROP COLUMN status;

-- Rename status_v2 to status
ALTER TABLE payments
  RENAME COLUMN status_v2 TO status;

-- ============================================
-- 7. Drop backup column
-- ============================================

ALTER TABLE payments
  DROP COLUMN IF EXISTS status_old;

-- ============================================
-- 8. Add constraint
-- ============================================

ALTER TABLE payments
  ADD CONSTRAINT payments_status_valid
  CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'refunded'));

-- ============================================
-- 9. Final Verification
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Payment status enum standardization: COMPLETE';
  RAISE NOTICE '';
  RAISE NOTICE 'Verification:';

  -- Verify column type
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments'
      AND column_name = 'status'
      AND udt_name = 'payment_status_v2'
  ) THEN
    RAISE NOTICE '  ✓ status column is payment_status_v2 type';
  ELSE
    RAISE EXCEPTION '  ✗ status column is not payment_status_v2 type';
  END IF;

  -- Verify all values are valid
  IF NOT EXISTS(SELECT 1 FROM payments WHERE status NOT IN ('pending', 'authorized', 'captured', 'failed', 'refunded')) THEN
    RAISE NOTICE '  ✓ All payment status values are valid';
  ELSE
    RAISE EXCEPTION '  ✗ Invalid payment status values found';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Payment Status Standardization: PASSED';
END $$;

COMMIT;

-- ============================================
-- Post-Migration Checklist
-- ============================================
--
-- [ ] Verify payment queries work with new enum
-- [ ] Update application code: remove references to old payment_status values
-- [ ] Update any payment processing logic to use new values:
--     - Use 'authorized' for pre-approved payments
--     - Use 'captured' for completed payments (old: 'succeeded' or 'success')
-- [ ] Run test queries for payment status filtering
-- [ ] Verify payment status reports still work correctly
-- [ ] Delete old payment_status enum if no longer used elsewhere
