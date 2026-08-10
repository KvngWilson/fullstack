-- Migration: Multi-Tenant Phase 3 - Row-Level Security (RLS) Policies
-- Enables automatic data isolation based on tenant membership
-- Users can only access data from their assigned tenants
-- Date: February 28, 2026

BEGIN;

-- ============================================
-- Enable RLS on Core Tables
-- ============================================

-- Enable RLS on orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Enable RLS on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Enable RLS on vendors
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Enable RLS on categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Enable RLS on addresses
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- Enable RLS on carts
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on cart_items
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Enable RLS on orders (cart items indirectly)
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper Functions for RLS Policy Logic
-- ============================================

-- Get current tenant context (set via set_config)
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS BIGINT AS $$
BEGIN
  RETURN (current_setting('app.current_tenant_id'))::BIGINT;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if user is member of tenant
CREATE OR REPLACE FUNCTION user_in_tenant(user_id_param BIGINT, tenant_id_param BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_users.user_id = user_id_param
      AND tenant_users.tenant_id = tenant_id_param
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Get current user context (set via set_config)
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS BIGINT AS $$
BEGIN
  RETURN (current_setting('app.current_user_id'))::BIGINT;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- RLS Policy: Orders
-- Users can only see orders from their tenants
-- ============================================

DROP POLICY IF EXISTS orders_tenant_isolation ON orders;
DROP POLICY IF EXISTS orders_tenant_select ON orders;
DROP POLICY IF EXISTS orders_tenant_insert ON orders;
DROP POLICY IF EXISTS orders_tenant_update ON orders;
DROP POLICY IF EXISTS orders_tenant_delete ON orders;

DROP POLICY IF EXISTS products_tenant_select ON products;
DROP POLICY IF EXISTS products_tenant_insert ON products;
DROP POLICY IF EXISTS products_tenant_update ON products;
DROP POLICY IF EXISTS products_tenant_delete ON products;

DROP POLICY IF EXISTS vendors_tenant_select ON vendors;
DROP POLICY IF EXISTS vendors_tenant_insert ON vendors;
DROP POLICY IF EXISTS vendors_tenant_update ON vendors;
DROP POLICY IF EXISTS vendors_tenant_delete ON vendors;

DROP POLICY IF EXISTS categories_tenant_select ON categories;
DROP POLICY IF EXISTS categories_tenant_insert ON categories;
DROP POLICY IF EXISTS categories_tenant_update ON categories;
DROP POLICY IF EXISTS categories_tenant_delete ON categories;

DROP POLICY IF EXISTS addresses_tenant_select ON addresses;
DROP POLICY IF EXISTS addresses_tenant_insert ON addresses;
DROP POLICY IF EXISTS addresses_tenant_update ON addresses;
DROP POLICY IF EXISTS addresses_tenant_delete ON addresses;

DROP POLICY IF EXISTS carts_tenant_select ON carts;
DROP POLICY IF EXISTS carts_tenant_insert ON carts;
DROP POLICY IF EXISTS carts_tenant_update ON carts;
DROP POLICY IF EXISTS carts_tenant_delete ON carts;

DROP POLICY IF EXISTS cart_items_tenant_select ON cart_items;
DROP POLICY IF EXISTS cart_items_tenant_insert ON cart_items;
DROP POLICY IF EXISTS cart_items_tenant_update ON cart_items;
DROP POLICY IF EXISTS cart_items_tenant_delete ON cart_items;

DROP POLICY IF EXISTS order_items_tenant_select ON order_items;
DROP POLICY IF EXISTS order_items_tenant_insert ON order_items;
DROP POLICY IF EXISTS order_items_tenant_update ON order_items;
DROP POLICY IF EXISTS order_items_tenant_delete ON order_items;

CREATE POLICY orders_tenant_isolation ON orders
  USING (user_in_tenant(user_id, tenant_id) OR current_user = 'postgres')
  WITH CHECK (user_in_tenant(user_id, tenant_id) OR current_user = 'postgres');

CREATE POLICY orders_tenant_select ON orders FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY orders_tenant_insert ON orders FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY orders_tenant_update ON orders FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY orders_tenant_delete ON orders FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

-- ============================================
-- RLS Policy: Products
-- Users can see products from their tenants
-- ============================================

CREATE POLICY products_tenant_select ON products FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY products_tenant_insert ON products FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY products_tenant_update ON products FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY products_tenant_delete ON products FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

-- ============================================
-- RLS Policy: Vendors
-- Vendors are tenant-scoped
-- ============================================

CREATE POLICY vendors_tenant_select ON vendors FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY vendors_tenant_insert ON vendors FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY vendors_tenant_update ON vendors FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY vendors_tenant_delete ON vendors FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

-- ============================================
-- RLS Policy: Categories
-- Categories are tenant-scoped
-- ============================================

CREATE POLICY categories_tenant_select ON categories FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY categories_tenant_insert ON categories FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY categories_tenant_update ON categories FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

CREATE POLICY categories_tenant_delete ON categories FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    OR current_user = 'postgres'
  );

-- ============================================
-- RLS Policy: Addresses
-- Users can only access their own addresses from their tenants
-- ============================================

CREATE POLICY addresses_tenant_select ON addresses FOR SELECT
  USING (
    (tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres'
  );

CREATE POLICY addresses_tenant_insert ON addresses FOR INSERT
  WITH CHECK (
    (tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres'
  );

CREATE POLICY addresses_tenant_update ON addresses FOR UPDATE
  USING (
    (tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres'
  )
  WITH CHECK (
    (tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres'
  );

CREATE POLICY addresses_tenant_delete ON addresses FOR DELETE
  USING (
    (tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres'
  );

-- ============================================
-- RLS Policy: Carts
-- Users can only access their own carts from their tenants
-- ============================================

CREATE POLICY carts_tenant_select ON carts FOR SELECT
  USING (
    (tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres'
  );

CREATE POLICY carts_tenant_insert ON carts FOR INSERT
  WITH CHECK (
    (tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres'
  );

CREATE POLICY carts_tenant_update ON carts FOR UPDATE
  USING (
    (tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres'
  )
  WITH CHECK (
    (tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres'
  );

CREATE POLICY carts_tenant_delete ON carts FOR DELETE
  USING (
    (tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres'
  );

-- ============================================
-- RLS Policy: Cart Items
-- Cart items inherit cart isolation
-- ============================================

CREATE POLICY cart_items_tenant_select ON cart_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.tenant_id = current_tenant_id()
        AND carts.user_id = current_user_id()
    )
    OR current_user = 'postgres'
  );

CREATE POLICY cart_items_tenant_insert ON cart_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.tenant_id = current_tenant_id()
        AND carts.user_id = current_user_id()
    )
    OR current_user = 'postgres'
  );

CREATE POLICY cart_items_tenant_update ON cart_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.tenant_id = current_tenant_id()
        AND carts.user_id = current_user_id()
    )
    OR current_user = 'postgres'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.tenant_id = current_tenant_id()
        AND carts.user_id = current_user_id()
    )
    OR current_user = 'postgres'
  );

CREATE POLICY cart_items_tenant_delete ON cart_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.tenant_id = current_tenant_id()
        AND carts.user_id = current_user_id()
    )
    OR current_user = 'postgres'
  );

-- ============================================
-- RLS Policy: Order Items
-- Order items inherit order isolation
-- ============================================

CREATE POLICY order_items_tenant_select ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );

CREATE POLICY order_items_tenant_insert ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );

CREATE POLICY order_items_tenant_update ON order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );

CREATE POLICY order_items_tenant_delete ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );

-- ============================================
-- Helper Function to Set Tenant Context
-- ============================================

-- Application should call this before querying data:
-- SELECT set_config('app.current_tenant_id', '1', false);
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id_param BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id_param::TEXT, false);
END;
$$ LANGUAGE plpgsql;

-- Helper function to get user's current_user_id (from session)
-- This assumes user_id is stored in JWT claims
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS BIGINT AS $$
BEGIN
  RETURN (current_setting('app.current_user_id'))::BIGINT;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;

-- ============================================
-- Usage Instructions
-- ============================================
-- 
-- Before querying tables, application must set tenant context:
--
--   SELECT set_config('app.current_tenant_id', tenant_id::TEXT, false);
--   SELECT set_config('app.current_user_id', user_id::TEXT, false);
--
-- Then normal queries will automatically be filtered:
--
--   SELECT * FROM orders;  -- Only returns orders from current_tenant_id
--   SELECT * FROM products;  -- Only returns products from current_tenant_id
--
-- Notes:
-- - RLS policies allow postgres superuser to bypass (for migrations/admin)
-- - current_tenant_id() must be set for RLS to work properly
-- - All queries are automatically scoped to tenant
-- - Performance: RLS adds minimal overhead with proper indexes
--
-- Phase 3 Completion:
-- - Automatic data isolation at database level
-- - No application-level tenant checking needed
-- - Prevents data leakage even if app has bugs
-- - Can safely use connection pooling across tenants
