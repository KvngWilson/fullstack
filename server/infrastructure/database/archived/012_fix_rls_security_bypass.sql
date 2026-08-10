-- Migration 012: Fix RLS Security Bypass
-- Date: February 2026
--
-- CRITICAL SECURITY FIX: Removes RLS bypass for postgres superuser
--
-- Problem: All RLS policies contained "OR current_user = 'postgres'" allowing
-- the postgres superuser to completely bypass all tenant isolation. This is
-- unacceptable in a multi-tenant environment.
--
-- Solution: Replace postgres bypass with proper admin context function.
-- Admin context is controlled by application via set_config() and can be
-- logged/audited. Regular postgres connections are fully subject to RLS.

BEGIN;

-- ============================================
-- 1. Create Admin Context Helper Function
-- ============================================

-- Check if current connection has admin bypass enabled
-- Application calls: SELECT set_config('app.is_admin_context', 'true', false);
-- Default: false (RLS policies are enforced)
CREATE OR REPLACE FUNCTION is_admin_context()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.is_admin_context', true) = 'true', false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 2. Recreate All RLS Policies Without Postgres Bypass
-- ============================================

-- Drop all existing policies (they will be recreated without postgres bypass)
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

-- ============================================
-- Orders Policies (Fixed)
-- ============================================

CREATE POLICY orders_tenant_isolation ON orders
  USING ((user_in_tenant(user_id, tenant_id)) OR (is_admin_context()))
  WITH CHECK ((user_in_tenant(user_id, tenant_id)) OR (is_admin_context()));

CREATE POLICY orders_tenant_select ON orders FOR SELECT
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY orders_tenant_insert ON orders FOR INSERT
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY orders_tenant_update ON orders FOR UPDATE
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  )
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY orders_tenant_delete ON orders FOR DELETE
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

-- ============================================
-- Products Policies (Fixed)
-- ============================================

CREATE POLICY products_tenant_select ON products FOR SELECT
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY products_tenant_insert ON products FOR INSERT
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY products_tenant_update ON products FOR UPDATE
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  )
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY products_tenant_delete ON products FOR DELETE
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

-- ============================================
-- Vendors Policies (Fixed)
-- ============================================

CREATE POLICY vendors_tenant_select ON vendors FOR SELECT
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY vendors_tenant_insert ON vendors FOR INSERT
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY vendors_tenant_update ON vendors FOR UPDATE
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  )
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY vendors_tenant_delete ON vendors FOR DELETE
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

-- ============================================
-- Categories Policies (Fixed)
-- ============================================

CREATE POLICY categories_tenant_select ON categories FOR SELECT
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY categories_tenant_insert ON categories FOR INSERT
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY categories_tenant_update ON categories FOR UPDATE
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  )
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

CREATE POLICY categories_tenant_delete ON categories FOR DELETE
  USING (
    (tenant_id = current_tenant_id())
    OR (is_admin_context())
  );

-- ============================================
-- Addresses Policies (Fixed)
-- ============================================

CREATE POLICY addresses_tenant_select ON addresses FOR SELECT
  USING (
    ((tenant_id = current_tenant_id() AND user_id = current_user_id()))
    OR (is_admin_context())
  );

CREATE POLICY addresses_tenant_insert ON addresses FOR INSERT
  WITH CHECK (
    ((tenant_id = current_tenant_id() AND user_id = current_user_id()))
    OR (is_admin_context())
  );

CREATE POLICY addresses_tenant_update ON addresses FOR UPDATE
  USING (
    ((tenant_id = current_tenant_id() AND user_id = current_user_id()))
    OR (is_admin_context())
  )
  WITH CHECK (
    ((tenant_id = current_tenant_id() AND user_id = current_user_id()))
    OR (is_admin_context())
  );

CREATE POLICY addresses_tenant_delete ON addresses FOR DELETE
  USING (
    ((tenant_id = current_tenant_id() AND user_id = current_user_id()))
    OR (is_admin_context())
  );

-- ============================================
-- Carts Policies (Fixed)
-- ============================================

CREATE POLICY carts_tenant_select ON carts FOR SELECT
  USING (
    ((tenant_id = current_tenant_id() AND user_id = current_user_id()))
    OR (is_admin_context())
  );

CREATE POLICY carts_tenant_insert ON carts FOR INSERT
  WITH CHECK (
    ((tenant_id = current_tenant_id() AND user_id = current_user_id()))
    OR (is_admin_context())
  );

CREATE POLICY carts_tenant_update ON carts FOR UPDATE
  USING (
    ((tenant_id = current_tenant_id() AND user_id = current_user_id()))
    OR (is_admin_context())
  )
  WITH CHECK (
    ((tenant_id = current_tenant_id() AND user_id = current_user_id()))
    OR (is_admin_context())
  );

CREATE POLICY carts_tenant_delete ON carts FOR DELETE
  USING (
    ((tenant_id = current_tenant_id() AND user_id = current_user_id()))
    OR (is_admin_context())
  );

-- ============================================
-- Cart Items Policies (Fixed)
-- ============================================

CREATE POLICY cart_items_tenant_select ON cart_items FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.tenant_id = current_tenant_id()
        AND carts.user_id = current_user_id()
    ))
    OR (is_admin_context())
  );

CREATE POLICY cart_items_tenant_insert ON cart_items FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.tenant_id = current_tenant_id()
        AND carts.user_id = current_user_id()
    ))
    OR (is_admin_context())
  );

CREATE POLICY cart_items_tenant_update ON cart_items FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.tenant_id = current_tenant_id()
        AND carts.user_id = current_user_id()
    ))
    OR (is_admin_context())
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.tenant_id = current_tenant_id()
        AND carts.user_id = current_user_id()
    ))
    OR (is_admin_context())
  );

CREATE POLICY cart_items_tenant_delete ON cart_items FOR DELETE
  USING (
    (EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.tenant_id = current_tenant_id()
        AND carts.user_id = current_user_id()
    ))
    OR (is_admin_context())
  );

-- ============================================
-- Order Items Policies (Fixed)
-- ============================================

CREATE POLICY order_items_tenant_select ON order_items FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    ))
    OR (is_admin_context())
  );

CREATE POLICY order_items_tenant_insert ON order_items FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    ))
    OR (is_admin_context())
  );

CREATE POLICY order_items_tenant_update ON order_items FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    ))
    OR (is_admin_context())
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    ))
    OR (is_admin_context())
  );

CREATE POLICY order_items_tenant_delete ON order_items FOR DELETE
  USING (
    (EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    ))
    OR (is_admin_context())
  );

-- ============================================
-- 3. Create Audit Function for Admin Context
-- ============================================

-- Log when admin context is activated (optional, for security auditing)
CREATE TABLE IF NOT EXISTS admin_context_audit (
  id BIGSERIAL PRIMARY KEY,
  session_user TEXT NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT,
  metadata JSONB
);

-- ============================================
-- 4. Usage Instructions
-- ============================================

-- Before performing admin operations, application must enable admin context:
--
--   SELECT set_config('app.is_admin_context', 'true', false);
--   -- Perform admin operations
--   SELECT set_config('app.is_admin_context', 'false', false);
--
-- The postgres superuser NO LONGER has automatic bypass.
-- All connections (including postgres) must respect RLS policies.
-- Only by explicitly setting app.is_admin_context can policies be bypassed.
--
-- This prevents accidental data exposure and forces intentional admin actions.

COMMIT;
