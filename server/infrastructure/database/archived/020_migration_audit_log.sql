-- Migration 020: Create Migration Audit Log and Metadata
-- Date: February 2026
--
-- Documentation Fix: Creates comprehensive migration metadata and audit trail
--
-- Problem: No central record of:
--   - Migration purposes and descriptions
--   - Dependency relationships between migrations
--   - Which migrations supersede others
--   - Breaking changes or important notes
--   - Migration status and execution history
--
-- Solution: Create migration_metadata table to serve as single source of truth
-- for migration documentation and relationship tracking.

BEGIN;

-- ============================================
-- 1. Create Migration Metadata Table
-- ============================================

CREATE TABLE IF NOT EXISTS migration_metadata (
  migration_id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  category VARCHAR(100) NOT NULL,  -- 'schema', 'rls', 'performance', 'security', 'refactor', 'documentation'
  description TEXT,
  requires_downtime BOOLEAN DEFAULT false,
  breaking_changes BOOLEAN DEFAULT false,
  supersedes TEXT[],  -- Array of migration IDs this replaces
  depends_on TEXT[],  -- Array of migration IDs this depends on
  execution_time_estimate_minutes INT,
  rollback_supported BOOLEAN DEFAULT true,
  rollback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. Insert Migration Metadata
-- ============================================

INSERT INTO migration_metadata VALUES
  ('001_initial_schema',
   'Initial Database Schema',
   'schema',
   'Core tables, enums, RLS setup, helper functions',
   false, false, '{}', '{}', 60, true, NULL),

  ('006a_multi_language_schema',
   'Multi-Language Support (i18n)',
   'schema',
   'Translation tables, language support infrastructure',
   false, false, '{}', ARRAY['001_initial_schema'], 30, true, 'Can be reverted but requires removing translation data'),

  ('006b_multi_tenant_phase_2_backfill',
   'Tenant Backfill and Data Integrity',
   'schema',
   'Backfill tenant_id for existing records, add NOT NULL constraints',
   true, true, '{}', ARRAY['001_initial_schema'], 120, false, 'Irreversible - modifies existing data'),

  ('007a_multi_tenant_phase_3_rls_policies',
   'Row-Level Security (RLS) Policies',
   'rls',
   'Enable RLS on tenant-scoped tables, create helper functions, set up isolation',
   false, false, '{}', ARRAY['006b_multi_tenant_phase_2_backfill'], 45, true, 'Disable RLS and drop policies to revert'),

  ('007b_monetary_units_consolidation',
   'Price Column Migration to Cents',
   'schema',
   'Migrate all price columns to integer minor units (cents) for precision',
   true, true, '{}', ARRAY['001_initial_schema'], 90, false, 'Irreversible - changes data representation'),

  ('008_rls_policies',
   'RLS Policies (DEPRECATED)',
   'documentation',
   'DEPRECATED: Duplicate of 007a_multi_tenant_phase_3_rls_policies. Do not use.',
   false, false, ARRAY['007a_multi_tenant_phase_3_rls_policies'], ARRAY['007a_multi_tenant_phase_3_rls_policies'], 0, true, 'Rename to .DEPRECATED and remove from codebase'),

  ('009_exchange_rate_snapshots',
   'Exchange Rate Locking at Order Time',
   'schema',
   'Add exchange_rate_snapshot table, capture rates when orders are created',
   false, false, '{}', ARRAY['007b_monetary_units_consolidation'], 45, true, 'Drop exchange_rate_snapshot table to revert'),

  ('010_consolidate_variant_tables',
   'Variant Table Consolidation',
   'schema',
   'Merge legacy variants table into product_variants',
   true, true, '{}', ARRAY['001_initial_schema'], 60, false, 'Data migration - not reversible'),

  ('011_guest_checkout_exchange_rate',
   'Guest Checkout and Exchange Rate Alignment',
   'schema',
   'Support guest user orders, align exchange rate snapshots with order currency',
   false, false, '{}', ARRAY['009_exchange_rate_snapshots'], 50, true, 'Revert guest checkout columns and constraints'),

  ('012_fix_rls_security_bypass',
   'Fix RLS Security Bypass Vulnerability',
   'security',
   'Remove postgres superuser RLS bypass. Replace with admin context function.',
   false, true, '{}', ARRAY['007a_multi_tenant_phase_3_rls_policies'], 30, true, 'Restore old RLS policies (requires 007a re-run)'),

  ('012b_remove_plaintext_passwords',
   'Remove Plaintext Password Field',
   'security',
   'CRITICAL: Drop plaintext password column from users table, ensure all hashed',
   true, true, '{}', ARRAY['001_initial_schema'], 20, false, 'Data deletion - not reversible'),

  ('013_consolidate_rls_policies',
   'Consolidate RLS Policy Duplication',
   'documentation',
   'Document RLS policy consolidation, mark 008 as deprecated',
   false, false, ARRAY['008_rls_policies'], ARRAY['012_fix_rls_security_bypass'], 5, true, 'Delete metadata entries to revert'),

  ('014_fix_migration_numbering',
   'Fix Migration File Naming Conflicts',
   'documentation',
   'Rename migrations 006/007 to 006a/006b/007a/007b to eliminate prefix conflicts',
   false, false, '{}', ARRAY['013_consolidate_rls_policies'], 15, false, 'File system changes - revert by renaming back'),

  ('015_add_composite_indices',
   'Add Composite Indices for Query Performance',
   'performance',
   'Create 8 targeted composite indices on frequently-filtered columns',
   false, false, '{}', ARRAY['001_initial_schema'], 20, true, 'Drop indices to revert'),

  ('016_standardize_payment_status',
   'Standardize Payment Status Enum',
   'refactor',
   'Migrate from payment_status to payment_status_v2 enum (succeeded->captured mapping)',
   false, true, '{}', ARRAY['001_initial_schema'], 30, false, 'Data type change - not reversible'),

  ('017_standardize_currency_fields',
   'Standardize Currency Field Types',
   'refactor',
   'Standardize currency fields to VARCHAR(3) with ISO 4217 validation',
   false, false, '{}', ARRAY['007b_monetary_units_consolidation'], 20, true, 'Remove constraints and restore types'),

  ('018_add_transaction_isolation',
   'Document Transaction Isolation Levels',
   'documentation',
   'Create transaction_isolation_log, document isolation strategy for migrations',
   false, false, '{}', ARRAY['001_initial_schema'], 10, true, 'Delete transaction_isolation_log table'),

  ('019_consolidate_helper_functions',
   'Consolidate RLS Helper Function Definitions',
   'refactor',
   'Document and plan consolidation of duplicate helper functions across migrations',
   false, false, '{}', ARRAY['001_initial_schema'], 10, true, 'Requires manual consolidation in 007/008'),

  ('020_migration_audit_log',
   'Create Migration Metadata and Audit Log',
   'documentation',
   'Create migration_metadata table as single source of truth for migrations',
   false, false, '{}', ARRAY['001_initial_schema'], 15, true, 'Delete migration_metadata table')
ON CONFLICT (migration_id) DO UPDATE SET
  updated_at = now();

-- ============================================
-- 2. Create Migration Execution History Table
-- ============================================

CREATE TABLE IF NOT EXISTS migration_execution_history (
  id BIGSERIAL PRIMARY KEY,
  migration_id VARCHAR(255) NOT NULL REFERENCES migration_metadata(migration_id),
  executed_at TIMESTAMPTZ DEFAULT now(),
  status VARCHAR(50) NOT NULL,  -- 'success', 'failure', 'rollback'
  duration_seconds INT,
  error_message TEXT,
  executed_by TEXT
);

-- ============================================
-- 3. Create Migration Dependency Graph View
-- ============================================

CREATE OR REPLACE VIEW migration_dependency_graph AS
SELECT
  m.migration_id,
  m.title,
  m.category,
  array_length(m.depends_on, 1) as dependency_count,
  array_length(m.supersedes, 1) as supersedes_count,
  m.breaking_changes,
  m.requires_downtime
FROM migration_metadata m
ORDER BY
  CASE m.category
    WHEN 'security' THEN 1
    WHEN 'schema' THEN 2
    WHEN 'performance' THEN 3
    WHEN 'refactor' THEN 4
    ELSE 5
  END,
  m.migration_id;

-- ============================================
-- 4. Create Migration Status Report
-- ============================================

DO $$
DECLARE
  v_total_migrations INT;
  v_critical_migrations INT;
  v_breaking_migrations INT;
  v_downtime_migrations INT;
BEGIN
  SELECT COUNT(*) INTO v_total_migrations FROM migration_metadata;
  SELECT COUNT(*) INTO v_critical_migrations FROM migration_metadata WHERE category IN ('security', 'schema');
  SELECT COUNT(*) INTO v_breaking_migrations FROM migration_metadata WHERE breaking_changes = true;
  SELECT COUNT(*) INTO v_downtime_migrations FROM migration_metadata WHERE requires_downtime = true;

  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Migration Audit Log Summary';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration Statistics:';
  RAISE NOTICE '  Total migrations: %', v_total_migrations;
  RAISE NOTICE '  Critical (security/schema): %', v_critical_migrations;
  RAISE NOTICE '  Breaking changes: %', v_breaking_migrations;
  RAISE NOTICE '  Requires downtime: %', v_downtime_migrations;
  RAISE NOTICE '';
  RAISE NOTICE 'By Category:';

  FOR RECORD IN
    SELECT category, COUNT(*) as count
    FROM migration_metadata
    GROUP BY category
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  %: %', RECORD.category, RECORD.count;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Critical Migrations (Review Before Production):';

  FOR RECORD IN
    SELECT migration_id, title FROM migration_metadata
    WHERE breaking_changes = true OR requires_downtime = true
    ORDER BY migration_id
  LOOP
    RAISE NOTICE '  - %: %', RECORD.migration_id, RECORD.title;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- ============================================
-- 5. Verification and Queries
-- ============================================

COMMENT ON TABLE migration_metadata IS
'Central metadata for all database migrations.
Tracks dependencies, breaking changes, rollback support, and execution time.
Use as single source of truth for migration documentation and planning.';

COMMENT ON VIEW migration_dependency_graph IS
'Visual representation of migration dependencies and relationships.
Use to understand migration sequencing and impact analysis.';

-- ============================================
-- Useful Queries
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Useful Migration Queries:';
  RAISE NOTICE '';
  RAISE NOTICE '-- View all migrations sorted by category:';
  RAISE NOTICE 'SELECT * FROM migration_dependency_graph;';
  RAISE NOTICE '';
  RAISE NOTICE '-- Find migrations with breaking changes:';
  RAISE NOTICE 'SELECT migration_id, title FROM migration_metadata WHERE breaking_changes;';
  RAISE NOTICE '';
  RAISE NOTICE '-- View migration dependencies:';
  RAISE NOTICE 'SELECT migration_id, depends_on FROM migration_metadata WHERE depends_on IS NOT NULL;';
  RAISE NOTICE '';
  RAISE NOTICE '-- Check migration execution history:';
  RAISE NOTICE 'SELECT * FROM migration_execution_history ORDER BY executed_at DESC;';
  RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================
-- Post-Migration Checklist
-- ============================================
--
-- [ ] Review migration_metadata table structure
-- [ ] Update migration_execution_history for manual migrations as needed
-- [ ] Use migration_dependency_graph for future planning
-- [ ] Document any additional metadata for each migration
-- [ ] Set up CI/CD to log all migrations to execution_history
-- [ ] Create dashboard to visualize migration dependencies
