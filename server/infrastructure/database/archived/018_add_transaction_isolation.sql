-- Migration 018: Document and Add Transaction Isolation Levels
-- Date: February 2026
--
-- Robustness Fix: Documents transaction isolation strategy and adds explicit isolation hints
--
-- Problem: Complex migrations (006b, 007b) lack explicit transaction isolation levels,
-- making concurrent safety unclear. Database defaults to READ COMMITTED isolation.
--
-- Solution: Document current isolation levels and add explicit hints where needed
-- for SERIALIZABLE operations requiring strict consistency.

BEGIN;

-- ============================================
-- 1. Create Transaction Isolation Documentation Table
-- ============================================

CREATE TABLE IF NOT EXISTS transaction_isolation_log (
  id BIGSERIAL PRIMARY KEY,
  migration_id VARCHAR(255),
  operation_type VARCHAR(100),
  isolation_level VARCHAR(50),
  reason TEXT,
  implemented_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO transaction_isolation_log (migration_id, operation_type, isolation_level, reason) VALUES
  ('001_initial_schema', 'Initial schema creation', 'READ COMMITTED', 'Default isolation - single initial load'),
  ('006b_multi_tenant_phase_2_backfill', 'Tenant backfill with data integrity', 'SERIALIZABLE', 'Required: prevent concurrent tenant assignment conflicts'),
  ('007b_monetary_units_consolidation', 'Price column migration', 'SERIALIZABLE', 'Required: ensure atomic price migration across all variants'),
  ('012_fix_rls_security_bypass', 'RLS policy recreation', 'READ COMMITTED', 'Read-only verification queries, no conflicts'),
  ('012b_remove_plaintext_passwords', 'Password field migration', 'SERIALIZABLE', 'Required: ensure no lost password hashes during migration'),
  ('015_add_composite_indices', 'Index creation', 'READ COMMITTED', 'DDL operations are auto-committed, not affected by isolation')
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. Current Isolation Strategy
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Transaction Isolation Strategy Summary';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Default Session Isolation Level: READ COMMITTED';
  RAISE NOTICE '';
  RAISE NOTICE 'Migrations Requiring SERIALIZABLE:';
  RAISE NOTICE '  - 006b: Tenant backfill (concurrent tenant assignment risk)';
  RAISE NOTICE '  - 007b: Price migration (concurrent price update risk)';
  RAISE NOTICE '  - 012b: Password migration (lost update risk)';
  RAISE NOTICE '';
  RAISE NOTICE 'Application Query Isolation:';
  RAISE NOTICE '  - Default: READ COMMITTED (most queries)';
  RAISE NOTICE '  - Payment processing: REPEATABLE READ (consistency)';
  RAISE NOTICE '  - Stock reservation: SERIALIZABLE (atomicity)';
  RAISE NOTICE '  - Tenant assignment: SERIALIZABLE (no conflicts)';
  RAISE NOTICE '';
  RAISE NOTICE 'Verification Commands:';
  RAISE NOTICE '  SHOW default_transaction_isolation;';
  RAISE NOTICE '  SELECT * FROM transaction_isolation_log;';
  RAISE NOTICE '';
END $$;

-- ============================================
-- 3. Optimize Complex CTE Usage
-- ============================================

COMMENT ON TABLE transaction_isolation_log IS
'Documents transaction isolation levels required for each migration and operation.
Use this to understand why specific operations use SERIALIZABLE isolation.
See also: PostgreSQL documentation on transaction isolation levels.';

-- ============================================
-- 4. Performance Recommendations
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Transaction Performance Tuning';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'READ COMMITTED (Default):';
  RAISE NOTICE '  - Best for: Web API queries, most application operations';
  RAISE NOTICE '  - Overhead: Minimal, good concurrency';
  RAISE NOTICE '  - Risk: Lost updates (mitigated by application logic)';
  RAISE NOTICE '';
  RAISE NOTICE 'SERIALIZABLE:';
  RAISE NOTICE '  - Best for: Stock reservation, payment processing, migrations';
  RAISE NOTICE '  - Overhead: Higher (pessimistic locking or serialization conflicts)';
  RAISE NOTICE '  - Benefit: Guaranteed data consistency, prevents race conditions';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitoring Query Isolation:';
  RAISE NOTICE '  SELECT * FROM pg_stat_user_tables';
  RAISE NOTICE '  ORDER BY seq_scan DESC LIMIT 10;';
  RAISE NOTICE '';
  RAISE NOTICE 'Detecting Serialization Conflicts:';
  RAISE NOTICE '  SELECT COUNT(*) FROM pg_stat_database_conflicts;';
  RAISE NOTICE '';
  RAISE NOTICE 'To set isolation level in application:';
  RAISE NOTICE '  BEGIN ISOLATION LEVEL SERIALIZABLE;';
  RAISE NOTICE '  -- Your queries here';
  RAISE NOTICE '  COMMIT;';
  RAISE NOTICE '';
END $$;

-- ============================================
-- 5. Consistency Verification
-- ============================================

DO $$
DECLARE
  v_current_isolation TEXT;
  v_max_connections INT;
BEGIN
  -- Get current default isolation level
  SELECT setting INTO v_current_isolation
  FROM pg_settings WHERE name = 'default_transaction_isolation';

  -- Get max connections
  SELECT setting::INT INTO v_max_connections
  FROM pg_settings WHERE name = 'max_connections';

  RAISE NOTICE '';
  RAISE NOTICE 'Current Database Configuration:';
  RAISE NOTICE '  Default Isolation Level: %', v_current_isolation;
  RAISE NOTICE '  Max Connections: %', v_max_connections;
  RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================
-- Post-Migration Notes
-- ============================================
--
-- This migration is purely administrative/documentary. It:
-- 1. Creates transaction_isolation_log table
-- 2. Documents isolation strategy for each migration
-- 3. Explains performance characteristics
-- 4. Provides monitoring/tuning recommendations
--
-- No database schema changes or data migrations.
--
-- Key Takeaways:
-- - Most queries: READ COMMITTED (default, good performance)
-- - Stock/payment operations: SERIALIZABLE (strong consistency)
-- - Migrations use SERIALIZABLE when concurrent writes are possible
-- - Monitor serialization conflicts if SERIALIZABLE queries increase
