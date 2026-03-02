-- Migration: Multi-Tenant Phase 2 - Backfill Data
-- Backfills tenant_id for all existing records with 'default' tenant
-- Makes tenant_id NOT NULL (post-backfill enforcement)
-- Date: February 28, 2026

BEGIN;

-- ============================================
-- Ensure default tenant exists (from Phase 1)
-- ============================================

-- Create default tenant if it doesn't exist
INSERT INTO tenants (name, slug, plan, status, subscription_status, created_at, updated_at)
VALUES ('Default Organization', 'default', 'basic', 'active', 'active', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Get default tenant ID and backfill all tables
-- ============================================

WITH default_tenant AS (
  SELECT id FROM tenants WHERE slug = 'default' LIMIT 1
)

-- Backfill Orders
UPDATE orders
SET tenant_id = (SELECT id FROM default_tenant)
WHERE tenant_id IS NULL AND deleted_at IS NULL;

-- Backfill Products
WITH default_tenant AS (
  SELECT id FROM tenants WHERE slug = 'default' LIMIT 1
)
UPDATE products
SET tenant_id = (SELECT id FROM default_tenant)
WHERE tenant_id IS NULL AND deleted_at IS NULL;

-- Backfill Vendors
WITH default_tenant AS (
  SELECT id FROM tenants WHERE slug = 'default' LIMIT 1
)
UPDATE vendors
SET tenant_id = (SELECT id FROM default_tenant)
WHERE tenant_id IS NULL AND deleted_at IS NULL;

-- Backfill Categories
WITH default_tenant AS (
  SELECT id FROM tenants WHERE slug = 'default' LIMIT 1
)
UPDATE categories
SET tenant_id = (SELECT id FROM default_tenant)
WHERE tenant_id IS NULL AND deleted_at IS NULL;

-- Backfill Addresses
WITH default_tenant AS (
  SELECT id FROM tenants WHERE slug = 'default' LIMIT 1
)
UPDATE addresses
SET tenant_id = (SELECT id FROM default_tenant)
WHERE tenant_id IS NULL AND deleted_at IS NULL;

-- Backfill Carts
WITH default_tenant AS (
  SELECT id FROM tenants WHERE slug = 'default' LIMIT 1
)
UPDATE carts
SET tenant_id = (SELECT id FROM default_tenant)
WHERE tenant_id IS NULL;

-- Backfill Cart Items from cart tenant
UPDATE cart_items
SET tenant_id = carts.tenant_id
FROM carts
WHERE cart_items.cart_id = carts.id
  AND cart_items.tenant_id IS NULL;

-- ============================================
-- Make tenant_id NOT NULL (enforce after backfill)
-- ============================================

ALTER TABLE orders
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE products
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE vendors
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE categories
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE addresses
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE carts
  ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================
-- Add Foreign Key Constraints (post-backfill)
-- ============================================

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_tenant_id_fkey,
  ADD CONSTRAINT orders_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_tenant_id_fkey,
  ADD CONSTRAINT products_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE vendors
  DROP CONSTRAINT IF EXISTS vendors_tenant_id_fkey,
  ADD CONSTRAINT vendors_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_tenant_id_fkey,
  ADD CONSTRAINT categories_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE addresses
  DROP CONSTRAINT IF EXISTS addresses_tenant_id_fkey,
  ADD CONSTRAINT addresses_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE carts
  DROP CONSTRAINT IF EXISTS carts_tenant_id_fkey,
  ADD CONSTRAINT carts_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- ============================================
-- Add Indexes for tenant queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON orders(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON vendors(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_tenant_user ON addresses(tenant_id, user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_carts_tenant_user ON carts(tenant_id, user_id);

-- ============================================
-- Verify Data Integrity
-- ============================================

DO $$
DECLARE
  v_default_tenant_id BIGINT;
  v_orders_count INT;
  v_products_count INT;
  v_vendors_count INT;
  v_categories_count INT;
  v_addresses_count INT;
  v_carts_count INT;
BEGIN
  SELECT id INTO v_default_tenant_id FROM tenants WHERE slug = 'default' LIMIT 1;
  
  SELECT COUNT(*) INTO v_orders_count FROM orders WHERE tenant_id = v_default_tenant_id;
  SELECT COUNT(*) INTO v_products_count FROM products WHERE tenant_id = v_default_tenant_id;
  SELECT COUNT(*) INTO v_vendors_count FROM vendors WHERE tenant_id = v_default_tenant_id;
  SELECT COUNT(*) INTO v_categories_count FROM categories WHERE tenant_id = v_default_tenant_id;
  SELECT COUNT(*) INTO v_addresses_count FROM addresses WHERE tenant_id = v_default_tenant_id;
  SELECT COUNT(*) INTO v_carts_count FROM carts WHERE tenant_id = v_default_tenant_id;
  
  RAISE NOTICE 'Phase 2 Backfill Summary:';
  RAISE NOTICE 'Default Tenant ID: %', v_default_tenant_id;
  RAISE NOTICE 'Orders backfilled: %', v_orders_count;
  RAISE NOTICE 'Products backfilled: %', v_products_count;
  RAISE NOTICE 'Vendors backfilled: %', v_vendors_count;
  RAISE NOTICE 'Categories backfilled: %', v_categories_count;
  RAISE NOTICE 'Addresses backfilled: %', v_addresses_count;
  RAISE NOTICE 'Carts backfilled: %', v_carts_count;
END $$;

COMMIT;
