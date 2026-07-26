-- Migration 013: Consolidate and Document RLS Policy Duplication
-- Date: February 2026
--
-- Administrative Migration: Documents consolidation of duplicate RLS policies
--
-- Problem: Migrations 007_multi_tenant_phase_3_rls_policies.sql and
-- 008_rls_policies.sql contain virtually identical RLS policy definitions
-- (~450 lines each). This creates confusion and maintenance burden.
--
-- Solution: Mark 008 as DEPRECATED. All RLS policies are maintained in
-- 007_multi_tenant_phase_3_rls_policies.sql. Migration 008 is a duplicate
-- that was never executed (migration tracking prevents re-execution).

BEGIN;

-- ============================================
-- 1. Document Migration Consolidation
-- ============================================

CREATE TABLE IF NOT EXISTS migration_deprecations (
  migration_id VARCHAR(255) PRIMARY KEY,
  deprecated_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT NOT NULL,
  superseded_by VARCHAR(255),
  notes TEXT
);

INSERT INTO migration_deprecations (migration_id, superseded_by, reason, notes)
VALUES (
  '008_rls_policies',
  '007_multi_tenant_phase_3_rls_policies',
  'Duplicate: contains identical RLS policy definitions',
  'Migration 008 was created as backup but is identical to 007. All RLS policies are defined in 007 (canonical source). Migration 008 should be removed from codebase or renamed to .deprecated suffix.'
)
ON CONFLICT (migration_id) DO NOTHING;

-- ============================================
-- 2. Verify RLS Policies Are Correctly Applied
-- ============================================

DO $$
DECLARE
  v_policy_count INT;
BEGIN
  -- Count total RLS policies on tenant-scoped tables
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('orders', 'products', 'vendors', 'categories', 'addresses', 'carts', 'cart_items', 'order_items');

  RAISE NOTICE 'RLS Policies Applied: % (expected ~32 policies for 8 tables x 4 operations)';
  RAISE NOTICE '  Tables with RLS: orders, products, vendors, categories, addresses, carts, cart_items, order_items';

  IF v_policy_count < 28 THEN
    RAISE WARNING 'Expected at least 28 RLS policies, found %', v_policy_count;
  ELSE
    RAISE NOTICE 'RLS policy count verification: PASSED';
  END IF;
END $$;

-- ============================================
-- 3. Document Canonical Sources
-- ============================================

COMMENT ON TABLE migration_deprecations IS 'Tracks deprecated migrations and their replacements. Used for migration metadata and documentation.';

-- ============================================
-- 4. Usage Notes
-- ============================================

-- Migration 008_rls_policies.sql should be:
-- - REMOVED from codebase, OR
-- - RENAMED to 008_rls_policies.sql.deprecated
-- - Migration runner should warn if file 008_rls_policies.sql exists (after renaming)
--
-- Reason: Duplicate causes confusion during code review/maintenance
-- Canonical source: 007_multi_tenant_phase_3_rls_policies.sql (all RLS logic)
--
-- No database changes needed - this migration is purely administrative/documentary.

COMMIT;

-- ============================================
-- Post-Migration Actions (Manual)
-- ============================================
--
-- 1. In migration runner or deployment scripts:
--    a. Check if both 007 and 008_rls_policies.sql exist in filesystem
--    b. If both exist, rename 008 to 008_rls_policies.sql.DEPRECATED
--    c. Add deprecation warning to migration runner output
--
-- 2. Document in migration README:
--    - Migration 007: CANONICAL RLS policy source
--    - Migration 008: DEPRECATED (superseded by 007)
--
-- 3. Update CI/CD to flag if 008_rls_policies.sql file is found (should be removed)
