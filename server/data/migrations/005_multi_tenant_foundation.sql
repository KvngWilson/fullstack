-- Migration: Multi-tenant foundation (Phase 1)
-- Creates tenant tables and prepares for row-level security
-- Date: February 28, 2026
-- NOTE: This is Phase 1 - adds tenant infrastructure without breaking existing functionality

BEGIN;

-- ============================================
-- Tenant Management Tables
-- ============================================

-- Main tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  plan VARCHAR(20) NOT NULL DEFAULT 'free',  -- free, pro, enterprise
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, suspended, deleted
  
  -- Subscription & billing
  subscription_starts_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  max_users INT DEFAULT 10,
  max_products INT DEFAULT 100,
  max_storage_mb INT DEFAULT 1000,
  
  -- Configuration
  settings JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  
  -- Contact info
  primary_contact_email VARCHAR(255),
  primary_contact_name VARCHAR(255),
  phone VARCHAR(50),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Tenant-User relationship (many-to-many)
CREATE TABLE IF NOT EXISTS tenant_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',  -- owner, admin, member, viewer
  
  -- Access control
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by BIGINT REFERENCES users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Tenant invitation tokens
CREATE TABLE IF NOT EXISTS tenant_invitations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  invited_by BIGINT REFERENCES users(id),
  
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Indexes for Tenant Tables
-- ============================================

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_plan ON tenants(plan);

CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id) WHERE is_active = true;
CREATE INDEX idx_tenant_users_user ON tenant_users(user_id) WHERE is_active = true;
CREATE INDEX idx_tenant_users_role ON tenant_users(tenant_id, role);

CREATE INDEX idx_tenant_invitations_token ON tenant_invitations(token);
CREATE INDEX idx_tenant_invitations_tenant ON tenant_invitations(tenant_id);
CREATE INDEX idx_tenant_invitations_email ON tenant_invitations(email);

-- ============================================
-- Add tenant_id to existing tables (nullable for now)
-- ============================================

-- Phase 1: Add nullable tenant_id columns
-- Phase 2 (separate migration): Make NOT NULL after backfilling data
-- Phase 3 (separate migration): Enable Row-Level Security

-- Orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id) WHERE tenant_id IS NOT NULL;

-- Products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id) WHERE tenant_id IS NOT NULL;

-- Vendors (vendors might belong to tenant)
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors(tenant_id) WHERE tenant_id IS NOT NULL;

-- Carts
ALTER TABLE carts
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_carts_tenant ON carts(tenant_id) WHERE tenant_id IS NOT NULL;

-- Addresses
ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_addresses_tenant ON addresses(tenant_id) WHERE tenant_id IS NOT NULL;

-- Categories (might be global or tenant-specific)
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================
-- Helper Functions for Multi-Tenant Context
-- ============================================

-- Function to set current tenant context (used by middleware)
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id_param BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id_param::TEXT, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get current tenant context
CREATE OR REPLACE FUNCTION get_tenant_context()
RETURNS BIGINT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::BIGINT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user belongs to tenant
CREATE OR REPLACE FUNCTION user_belongs_to_tenant(user_id_param BIGINT, tenant_id_param BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = user_id_param
      AND tenant_id = tenant_id_param
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's tenants
CREATE OR REPLACE FUNCTION get_user_tenants(user_id_param BIGINT)
RETURNS TABLE(tenant_id BIGINT, tenant_name VARCHAR, role VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, tu.role
  FROM tenants t
  INNER JOIN tenant_users tu ON t.id = tu.tenant_id
  WHERE tu.user_id = user_id_param
    AND tu.is_active = true
    AND t.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Create default tenant for existing data
-- ============================================

-- Create a default tenant for bootstrapping
INSERT INTO tenants (name, slug, plan, status, created_at)
VALUES ('Default Organization', 'default', 'enterprise', 'active', now())
ON CONFLICT DO NOTHING;

-- ============================================
-- Triggers for tenant operations
-- ============================================

-- Auto-update updated_at on tenants
DROP TRIGGER IF EXISTS trigger_tenants_updated_at ON tenants;
CREATE TRIGGER trigger_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================
-- Views for multi-tenant queries
-- ============================================

-- View for tenant statistics
CREATE OR REPLACE VIEW tenant_statistics AS
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.plan,
  t.status,
  COUNT(DISTINCT tu.user_id) AS user_count,
  COUNT(DISTINCT p.id) AS product_count,
  COUNT(DISTINCT o.id) AS order_count,
  SUM(o.total) AS total_revenue,
  t.created_at
FROM tenants t
LEFT JOIN tenant_users tu ON t.id = tu.tenant_id AND tu.is_active = true
LEFT JOIN products p ON t.id = p.tenant_id AND p.deleted_at IS NULL
LEFT JOIN orders o ON t.id = o.tenant_id AND o.deleted_at IS NULL
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name, t.plan, t.status, t.created_at;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE tenants IS 
  'Multi-tenant organization table. Each tenant represents an isolated customer/organization.';

COMMENT ON TABLE tenant_users IS 
  'Many-to-many relationship between tenants and users. Users can belong to multiple tenants.';

COMMENT ON FUNCTION set_tenant_context IS 
  'Sets the current tenant ID in session configuration for Row-Level Security policies';

COMMENT ON FUNCTION user_belongs_to_tenant IS 
  'Checks if a user has active membership in a tenant';

COMMENT ON COLUMN orders.tenant_id IS 
  'Tenant isolation field. Will be made NOT NULL in Phase 2 after data backfill.';

COMMENT ON COLUMN products.tenant_id IS 
  'Tenant isolation field. Will be made NOT NULL in Phase 2 after data backfill.';

-- ============================================
-- Admin utility queries
-- ============================================

-- Show tenant usage
CREATE OR REPLACE VIEW tenant_usage AS
SELECT 
  t.id,
  t.name,
  t.plan,
  COUNT(DISTINCT tu.user_id) AS current_users,
  t.max_users,
  COUNT(DISTINCT p.id) AS current_products,
  t.max_products,
  t.status
FROM tenants t
LEFT JOIN tenant_users tu ON t.id = tu.tenant_id AND tu.is_active = true
LEFT JOIN products p ON t.id = p.tenant_id AND p.deleted_at IS NULL
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name, t.plan, t.max_users, t.max_products, t.status;

COMMIT;

-- ============================================
-- Post-Migration Instructions
-- ============================================

-- After this migration:
-- 1. Backfill tenant_id for all existing records (assign to default tenant)
-- 2. Run Phase 2 migration to make tenant_id NOT NULL
-- 3. Run Phase 3 migration to enable Row-Level Security policies
-- 4. Update application middleware to set tenant context on each request
-- 5. Update all queries to filter by tenant_id

/*
Example backfill queries (run these after migration):

-- Backfill orders
UPDATE orders SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)
WHERE tenant_id IS NULL;

-- Backfill products  
UPDATE products SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)
WHERE tenant_id IS NULL;

-- Create tenant_user entries for all existing users
INSERT INTO tenant_users (tenant_id, user_id, role, is_active, joined_at, created_at)
SELECT 
  (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1),
  id,
  CASE 
    WHEN role = 'admin' THEN 'owner'
    WHEN role = 'vendor' THEN 'admin'
    ELSE 'member'
  END,
  true,
  created_at,
  created_at
FROM users
WHERE id NOT IN (SELECT user_id FROM tenant_users);
*/
