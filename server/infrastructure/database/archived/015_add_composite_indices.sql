-- Migration 015: Add Composite Indices for Query Performance
-- Date: February 2026
--
-- Performance Optimization: Creates targeted composite indices on frequently-filtered columns
--
-- Problem: Common query patterns lack proper composite indices:
--   - orders by (user_id, status, created_at)
--   - products by (tenant_id, vendor_id, is_active)
--   - product_variants by (product_id, sku)
--   - cart_items by (cart_id, product_variant_id)
--   - order_items by (order_id, product_id)
--   - payments by (order_id, status, created_at)
--   - addresses by (tenant_id, user_id, is_primary)
--   - tenant_users by (tenant_id, user_id, is_active)
--
-- Solution: Create 8 targeted composite indices using index naming convention

BEGIN;

-- ============================================
-- 1. Orders: Frequent query pattern (user_id, status, created_at)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_user_status_created
  ON orders(user_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_orders_user_status_created IS
  'Composite index for common query: SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC';

-- ============================================
-- 2. Products: Tenant + vendor + active status
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_tenant_vendor_active
  ON products(tenant_id, vendor_id, is_active)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_products_tenant_vendor_active IS
  'Composite index for product filtering by tenant, vendor, and active status';

-- ============================================
-- 3. Product Variants: Product + SKU lookup
-- ============================================

CREATE INDEX IF NOT EXISTS idx_product_variants_product_sku
  ON product_variants(product_id, sku)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_product_variants_product_sku IS
  'Composite index for variant lookup: SELECT * FROM product_variants WHERE product_id = ? AND sku = ?';

-- ============================================
-- 4. Cart Items: Cart + variant lookup (N+1 query fix support)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_variant
  ON cart_items(cart_id, product_variant_id)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_cart_items_cart_variant IS
  'Composite index for cart item operations: batch load variants by cart_id';

-- ============================================
-- 5. Order Items: Order + product lookup
-- ============================================

CREATE INDEX IF NOT EXISTS idx_order_items_order_product
  ON order_items(order_id, product_id);

COMMENT ON INDEX idx_order_items_order_product IS
  'Composite index for order item retrieval: SELECT * FROM order_items WHERE order_id = ? AND product_id = ?';

-- ============================================
-- 6. Payments: Order + status + timestamp
-- ============================================

CREATE INDEX IF NOT EXISTS idx_payments_order_status_created
  ON payments(order_id, status, created_at DESC);

COMMENT ON INDEX idx_payments_order_status_created IS
  'Composite index for payment queries: SELECT * FROM payments WHERE order_id = ? AND status = ? ORDER BY created_at DESC';

-- ============================================
-- 7. Addresses: Tenant + user + primary flag
-- ============================================

CREATE INDEX IF NOT EXISTS idx_addresses_tenant_user_primary
  ON addresses(tenant_id, user_id, is_primary)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_addresses_tenant_user_primary IS
  'Composite index for address queries: SELECT primary address FROM addresses WHERE tenant_id = ? AND user_id = ? AND is_primary = true';

-- ============================================
-- 8. Tenant Users: Tenant + user + active status
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_user_active
  ON tenant_users(tenant_id, user_id, is_active);

COMMENT ON INDEX idx_tenant_users_tenant_user_active IS
  'Composite index for tenant membership checks: SELECT * FROM tenant_users WHERE tenant_id = ? AND user_id = ? AND is_active = true';

-- ============================================
-- 2. Verification: Check Indices Are Created
-- ============================================

DO $$
DECLARE
  v_index_count INT;
BEGIN
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE indexname LIKE 'idx_%_user_status_created'
    OR indexname LIKE 'idx_%_tenant_vendor_%'
    OR indexname LIKE 'idx_%_product_sku'
    OR indexname LIKE 'idx_%_cart_variant'
    OR indexname LIKE 'idx_%_order_product'
    OR indexname LIKE 'idx_%_order_status_created'
    OR indexname LIKE 'idx_%_tenant_user_%'
    OR indexname LIKE 'idx_%_tenant_users_%';

  RAISE NOTICE 'Created % composite indices', v_index_count;

  IF v_index_count < 8 THEN
    RAISE WARNING 'Expected 8 composite indices, but found %', v_index_count;
  ELSE
    RAISE NOTICE 'Composite indices creation: PASSED';
  END IF;
END $$;

-- ============================================
-- 3. Performance Analysis Recommendations
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Index Performance Tuning:';
  RAISE NOTICE '';
  RAISE NOTICE 'To verify indices are being used:';
  RAISE NOTICE '  1. Run queries with EXPLAIN ANALYZE';
  RAISE NOTICE '  2. Check pg_stat_user_indexes for usage statistics:';
  RAISE NOTICE '     SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch';
  RAISE NOTICE '     FROM pg_stat_user_indexes';
  RAISE NOTICE '     WHERE idx_scan > 0;';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitor index bloat:';
  RAISE NOTICE '     SELECT schemaname, tablename, indexname, idx_blks_read, idx_blks_hit';
  RAISE NOTICE '     FROM pg_statio_user_indexes';
  RAISE NOTICE '     ORDER BY idx_blks_read DESC;';
  RAISE NOTICE '';
  RAISE NOTICE 'Rebuild if bloat > 20%:';
  RAISE NOTICE '     REINDEX INDEX CONCURRENTLY idx_orders_user_status_created;';
END $$;

COMMIT;

-- ============================================
-- Performance Expectations
-- ============================================
--
-- Expected performance improvements:
--
-- 1. Orders queries: 10-100x faster for (user_id, status, created_at) filters
-- 2. Product listing: 5-50x faster for multi-tenant product browsing
-- 3. Variant lookup: 10-100x faster for SKU-based searches
-- 4. Cart operations: 5-20x faster with composite index
-- 5. Payment history: 10-50x faster for payment status reports
--
-- Verify with EXPLAIN ANALYZE before/after migration
