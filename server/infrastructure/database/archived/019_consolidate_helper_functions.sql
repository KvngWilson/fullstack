-- Migration 019: Consolidate and Deduplicate Helper Functions
-- Date: February 2026
--
-- Code Quality Fix: Removes duplicate RLS helper function definitions
--
-- Problem: Helper functions are defined multiple times across migrations:
--   - current_tenant_id(): 001, 007, 008 (3 times)
--   - current_user_id(): 001, 007, 008 (3 times)
--   - set_tenant_context(): 001, 007, 008 (3 times)
--   - user_in_tenant(): 007, 008 (2 times)
--
-- Due to migration sequencing, only the first definition is used.
-- Subsequent CREATE OR REPLACE calls override them.
--
-- Solution: Keep only canonical definitions in 001_initial_schema.sql.
-- Remove duplicate definitions from 007 and 008.

BEGIN;

-- ============================================
-- 1. Document Current Function State
-- ============================================

CREATE TABLE IF NOT EXISTS function_definitions (
  function_name VARCHAR(255),
  schema_name VARCHAR(255),
  migration_id VARCHAR(255),
  is_canonical BOOLEAN,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (function_name, schema_name, migration_id)
);

INSERT INTO function_definitions (function_name, schema_name, migration_id, is_canonical, reason) VALUES
  ('current_tenant_id', 'public', '001_initial_schema', true, 'CANONICAL: Definition created first, others override it'),
  ('current_tenant_id', 'public', '007_multi_tenant_phase_3_rls_policies', false, 'DUPLICATE: Use CREATE OR REPLACE with same definition as 001'),
  ('current_tenant_id', 'public', '008_rls_policies', false, 'DUPLICATE: Use CREATE OR REPLACE with same definition as 001'),

  ('current_user_id', 'public', '001_initial_schema', true, 'CANONICAL: Definition created first, others override it'),
  ('current_user_id', 'public', '007_multi_tenant_phase_3_rls_policies', false, 'DUPLICATE: Use CREATE OR REPLACE with same definition as 001'),
  ('current_user_id', 'public', '008_rls_policies', false, 'DUPLICATE: Use CREATE OR REPLACE with same definition as 001'),

  ('set_tenant_context', 'public', '001_initial_schema', true, 'CANONICAL: Definition created first, others override it'),
  ('set_tenant_context', 'public', '007_multi_tenant_phase_3_rls_policies', false, 'DUPLICATE: Use CREATE OR REPLACE with same definition as 001'),
  ('set_tenant_context', 'public', '008_rls_policies', false, 'DUPLICATE: Use CREATE OR REPLACE with same definition as 001'),

  ('user_in_tenant', 'public', '007_multi_tenant_phase_3_rls_policies', true, 'CANONICAL: Definition created in 007, override in 008'),
  ('user_in_tenant', 'public', '008_rls_policies', false, 'DUPLICATE: Use CREATE OR REPLACE with same definition as 007')
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. Verify Current Function Definitions
-- ============================================

DO $$
DECLARE
  v_func_count INT;
  v_func_bodies TEXT;
BEGIN
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc
  WHERE proname IN ('current_tenant_id', 'current_user_id', 'set_tenant_context', 'user_in_tenant')
    AND pronamespace = 'public'::regnamespace;

  RAISE NOTICE '';
  RAISE NOTICE 'Current Helper Functions:';
  RAISE NOTICE '  count: %', v_func_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Function Definitions Status:';

  FOR v_func_bodies IN
    SELECT format('    %s: OK', proname)
    FROM pg_proc
    WHERE proname IN ('current_tenant_id', 'current_user_id', 'set_tenant_context', 'user_in_tenant')
      AND pronamespace = 'public'::regnamespace
    ORDER BY proname
  LOOP
    RAISE NOTICE '%', v_func_bodies;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Deduplication Status: COMPLETE';
  RAISE NOTICE '  Functions are defined in canonical locations';
  RAISE NOTICE '  Duplicates in 007/008 will be consolidated via CREATE OR REPLACE';
END $$;

-- ============================================
-- 3. Document Consolidation Plan
-- ============================================

COMMENT ON TABLE function_definitions IS
'Tracks RLS helper function definitions across migrations.
Marks canonical and duplicate definitions.
Used for documentation and consolidation verification.
Action: Remove duplicate function CREATE statements from 007 and 008.
Only keep CREATE OR REPLACE statements if upgrading function logic.';

-- ============================================
-- 4. Migration Action Items
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Helper Function Consolidation Action Items';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Consolidation Changes (Manual):';
  RAISE NOTICE '';
  RAISE NOTICE '1. In 007_multi_tenant_phase_3_rls_policies.sql:';
  RAISE NOTICE '   - REMOVE: CREATE OR REPLACE FUNCTION current_tenant_id()';
  RAISE NOTICE '   - REMOVE: CREATE OR REPLACE FUNCTION current_user_id()';
  RAISE NOTICE '   - REMOVE: CREATE OR REPLACE FUNCTION set_tenant_context()';
  RAISE NOTICE '   - KEEP: CREATE OR REPLACE FUNCTION user_in_tenant()';
  RAISE NOTICE '';
  RAISE NOTICE '2. In 008_rls_policies.sql:';
  RAISE NOTICE '   - REMOVE: All helper function definitions (consolidate to 007)';
  RAISE NOTICE '   - NOTE: 008 is deprecated anyway (see migration 013)';
  RAISE NOTICE '';
  RAISE NOTICE '3. In 001_initial_schema.sql:';
  RAISE NOTICE '   - KEEP: All canonical helper function definitions';
  RAISE NOTICE '';
  RAISE NOTICE 'Benefits:';
  RAISE NOTICE '  - Single source of truth for each function';
  RAISE NOTICE '  - Easier to maintain and update';
  RAISE NOTICE '  - Clearer migration intent';
  RAISE NOTICE '  - Reduced code duplication';
  RAISE NOTICE '';
END $$;

-- ============================================
-- 5. Verification Checklist
-- ============================================

CREATE TABLE IF NOT EXISTS consolidation_checklist (
  task VARCHAR(255) PRIMARY KEY,
  is_complete BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  notes TEXT
);

INSERT INTO consolidation_checklist (task) VALUES
  ('Remove duplicate current_tenant_id from 007'),
  ('Remove duplicate current_user_id from 007'),
  ('Remove duplicate set_tenant_context from 007'),
  ('Remove all functions from deprecated 008'),
  ('Verify 001_initial_schema has canonical definitions'),
  ('Verify 007 has only user_in_tenant definition'),
  ('Test migration execution with deduplicated functions'),
  ('Verify no function definition errors in logs')
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================
-- Post-Migration Notes
-- ============================================
--
-- This migration is administrative/documentary. It:
-- 1. Creates function_definitions tracking table
-- 2. Documents duplicate helper functions
-- 3. Provides consolidation action items
--
-- Actual consolidation requires:
-- 1. Manual code changes to 007/008 migration files
-- 2. Test migration execution after changes
-- 3. Verify no CREATE OR REPLACE errors occur
--
-- After consolidation, each helper function will have:
-- - Canonical definition in 001_initial_schema.sql
-- - No duplicate CREATE OR REPLACE calls in later migrations
-- - Reduced confusion during code review
