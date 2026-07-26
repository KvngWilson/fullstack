-- Migration 014: Fix Migration File Naming Conflicts
-- Date: February 2026
--
-- Administrative Migration: Documents resolution of duplicate numeric prefixes
--
-- Problem: Multiple migration files share the same numeric prefix, causing
-- ambiguity:
--   - 006_multi_language_schema.sql (i18n)
--   - 006_multi_tenant_phase_2_backfill.sql (tenant backfill)
--   - 007_multi_tenant_phase_3_rls_policies.sql (RLS policies)
--   - 007_monetary_units_consolidation.sql (pricing)
--   - 008_rls_policies.sql (DUPLICATE)
--
-- Solution: Rename to eliminate prefix conflicts using lettered suffixes (006a, 006b, etc)

BEGIN;

CREATE TABLE IF NOT EXISTS migration_naming_scheme (
  old_filename VARCHAR(255) PRIMARY KEY,
  new_filename VARCHAR(255),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO migration_naming_scheme (old_filename, new_filename, reason) VALUES
  ('006_multi_language_schema.sql',
   '006a_multi_language_schema.sql',
   'Phase: i18n (translations support)'),

  ('006_multi_tenant_phase_2_backfill.sql',
   '006b_multi_tenant_phase_2_backfill.sql',
   'Phase: multi-tenant (tenant_id backfill + data integrity)'),

  ('007_multi_tenant_phase_3_rls_policies.sql',
   '007a_multi_tenant_phase_3_rls_policies.sql',
   'Phase: multi-tenant (RLS policies - CANONICAL SOURCE)'),

  ('007_monetary_units_consolidation.sql',
   '007b_monetary_units_consolidation.sql',
   'Phase: pricing (price column migration to cents)'),

  ('008_rls_policies.sql',
   '008_rls_policies.sql.DEPRECATED',
   'DEPRECATED: Identical duplicate of 007a (remove from codebase)')
ON CONFLICT DO NOTHING;

-- ============================================
-- Migration Execution Order (Correct)
-- ============================================

CREATE TABLE IF NOT EXISTS migration_execution_order (
  sequence INT PRIMARY KEY,
  migration_id VARCHAR(255),
  description TEXT,
  dependencies TEXT[]
);

INSERT INTO migration_execution_order (sequence, migration_id, description, dependencies) VALUES
  (1, '001_initial_schema', 'Core schema, enums, initial functions', '{}'),
  (2, '006a_multi_language_schema', 'i18n translation tables', '{001}'),
  (3, '006b_multi_tenant_phase_2_backfill', 'Backfill tenant_id for existing records', '{001}'),
  (4, '007a_multi_tenant_phase_3_rls_policies', 'RLS policies for multi-tenant isolation', '{006b}'),
  (5, '007b_monetary_units_consolidation', 'Migrate prices to integer cents', '{001}'),
  (6, '008_rls_policies', 'DEPRECATED - DO NOT USE (identical to 007a)', '{007a}'),
  (7, '009_exchange_rate_snapshots', 'Snapshot exchange rates at order time', '{007b}'),
  (8, '010_consolidate_variant_tables', 'Merge old variants table into product_variants', '{001}'),
  (9, '011_guest_checkout_exchange_rate', 'Guest orders + exchange rate alignment', '{009}'),
  (10, '012_fix_rls_security_bypass', 'Security fix: Remove postgres superuser RLS bypass', '{007a}'),
  (11, '012b_remove_plaintext_passwords', 'Security fix: Remove plaintext password field', '{001}'),
  (12, '013_consolidate_rls_policies', 'Documentation: Mark 008 as deprecated', '{012}'),
  (13, '014_fix_migration_numbering', 'Documentation: Naming scheme consolidation', '{013}')
ON CONFLICT DO NOTHING;

-- ============================================
-- Verify Current File Names
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration Renaming Instructions:';
  RAISE NOTICE '';
  RAISE NOTICE 'Execute the following commands in the migrations directory:';
  RAISE NOTICE '  mv 006_multi_language_schema.sql 006a_multi_language_schema.sql';
  RAISE NOTICE '  mv 006_multi_tenant_phase_2_backfill.sql 006b_multi_tenant_phase_2_backfill.sql';
  RAISE NOTICE '  mv 007_multi_tenant_phase_3_rls_policies.sql 007a_multi_tenant_phase_3_rls_policies.sql';
  RAISE NOTICE '  mv 007_monetary_units_consolidation.sql 007b_monetary_units_consolidation.sql';
  RAISE NOTICE '  mv 008_rls_policies.sql 008_rls_policies.sql.DEPRECATED';
  RAISE NOTICE '';
  RAISE NOTICE 'Then update migration runner to:';
  RAISE NOTICE '  1. Accept new naming scheme (006a, 006b, etc.)';
  RAISE NOTICE '  2. Skip files with .DEPRECATED suffix';
  RAISE NOTICE '  3. Warn if old filename exists (rename instruction)';
END $$;

-- ============================================
-- Updates Required to Migration Runner
-- ============================================

COMMENT ON TABLE migration_naming_scheme IS
'Migration file renaming scheme to eliminate numeric prefix conflicts.
See migration_execution_order for correct execution sequence.
Update migration runner (migrationRunner.js) to:
  1. Load migrations from directory with new naming scheme
  2. Skip files ending in .DEPRECATED
  3. Validate execution order against dependencies in migration_execution_order
  4. Warn if old filenames detected';

COMMIT;

-- ============================================
-- Post-Migration Checklist
-- ============================================
--
-- [ ] Rename migration files in filesystem (use mv commands above)
-- [ ] Update migrationRunner.js to handle new naming scheme
-- [ ] Update migrationRunner.js to skip .DEPRECATED files
-- [ ] Add deprecation warning when file does not match expected name
-- [ ] Add validation: check migration_execution_order for dependency graph
-- [ ] Update migration README with new file naming
-- [ ] Run migration tests to verify renamed files execute correctly
-- [ ] Verify CI/CD detects renamed files as "no changes" (no re-execution)
