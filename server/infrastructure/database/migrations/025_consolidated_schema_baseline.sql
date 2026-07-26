-- Migration: Consolidated Schema Baseline (v025)
-- Purpose: Single authoritative migration that represents the effective schema
--          after consolidating all changes from migrations 001-024.
--          This baseline can be used for new database environments to avoid
--          running 20+ migrations sequentially.
-- Date: 2026-07-18
-- Notes: Replaces: 001-024 incremental migrations
--        Canonical enum: payment_status (not payment_status_v2)
--        Canonical RLS: From 013_consolidate_rls_policies.sql
--        Security fix: Plaintext password field removed (see 027_security_hardening.sql)

BEGIN;

-- =====================================================
-- Extensions
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;

-- =====================================================
-- Enums - Canonical Versions Only
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('customer', 'vendor', 'admin', 'support');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'success', 'failed', 'refunded');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'address_type') THEN
    CREATE TYPE address_type AS ENUM ('shipping', 'billing');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_status') THEN
    CREATE TYPE vendor_status AS ENUM ('active', 'suspended', 'inactive');
  END IF;
END $$;

-- =====================================================
-- Shared Functions - Deduped & Consolidated
-- =====================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS BIGINT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::BIGINT;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS BIGINT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::BIGINT;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION user_in_tenant(user_id_param BIGINT, tenant_id_param BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tenant_users
    WHERE user_id = user_id_param
      AND tenant_id = tenant_id_param
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id_param BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id_param::TEXT, false);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION default_tenant_id()
RETURNS BIGINT AS $$
DECLARE
  tenant_value BIGINT;
BEGIN
  SELECT id INTO tenant_value FROM tenants WHERE slug = 'default' LIMIT 1;
  RETURN tenant_value;
EXCEPTION WHEN undefined_table THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Core Account + Tenant Tables
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username VARCHAR(100),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role user_role NOT NULL DEFAULT 'customer',
  email_verified BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  plan VARCHAR(20) NOT NULL DEFAULT 'free',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'active',
  subscription_starts_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  max_users INT DEFAULT 10,
  max_products INT DEFAULT 100,
  max_storage_mb INT DEFAULT 1000,
  settings JSONB DEFAULT '{}'::jsonb,
  features JSONB DEFAULT '{}'::jsonb,
  primary_contact_email VARCHAR(255),
  primary_contact_name VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tenant_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS tenant_invitations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  tenant_id BIGINT NOT NULL DEFAULT default_tenant_id() REFERENCES tenants(id) ON DELETE RESTRICT,
  store_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status vendor_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT default_tenant_id() REFERENCES tenants(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  path LTREE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id BIGINT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  tenant_id BIGINT NOT NULL DEFAULT default_tenant_id() REFERENCES tenants(id) ON DELETE RESTRICT,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  brand TEXT,
  description TEXT,
  material TEXT,
  care_instructions TEXT,
  image_url TEXT,
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  attributes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS variants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE,
  size VARCHAR(50),
  color VARCHAR(50),
  stock_quantity INT NOT NULL DEFAULT 0,
  price_cents INTEGER CHECK (price_cents >= 0),
  price_adjustment_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS carts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id BIGINT NOT NULL DEFAULT default_tenant_id() REFERENCES tenants(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  tenant_id BIGINT REFERENCES tenants(id) ON DELETE RESTRICT,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_variant_id BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER CHECK (unit_price_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(cart_id, product_variant_id)
);

CREATE TABLE IF NOT EXISTS addresses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id BIGINT NOT NULL DEFAULT default_tenant_id() REFERENCES tenants(id) ON DELETE RESTRICT,
  type address_type,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  street TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tenant_id BIGINT NOT NULL DEFAULT default_tenant_id() REFERENCES tenants(id) ON DELETE RESTRICT,
  order_number VARCHAR(20) NOT NULL UNIQUE,
  status order_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'unfulfilled',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER DEFAULT 0,
  shipping_first_name TEXT,
  shipping_last_name TEXT,
  shipping_email TEXT,
  shipping_phone TEXT,
  shipping_street_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_postal_code TEXT,
  shipping_country TEXT,
  shipping_rate_id TEXT,
  shipping_carrier TEXT,
  shipping_service TEXT,
  tracking_number VARCHAR(100),
  estimated_delivery_date DATE,
  notes TEXT,
  billing_address_id BIGINT REFERENCES addresses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT orders_valid_total CHECK (total_cents >= 0),
  CONSTRAINT orders_valid_subtotal CHECK (subtotal_cents >= 0),
  CONSTRAINT orders_valid_tax CHECK (tax_cents >= 0),
  CONSTRAINT orders_valid_discount CHECK (discount_cents >= 0 OR discount_cents IS NULL),
  CONSTRAINT orders_valid_shipping CHECK (shipping_cents >= 0)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER CHECK (unit_price_cents >= 0),
  subtotal_cents INTEGER CHECK (subtotal_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_addresses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type address_type NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  street TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  stripe_payment_id TEXT UNIQUE,
  processor VARCHAR(50),
  transaction_id TEXT,
  authorization_url TEXT,
  access_code TEXT,
  amount_cents INTEGER CHECK (amount_cents >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status payment_status NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_cards (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_brand VARCHAR(50),
  last_four VARCHAR(4) NOT NULL,
  exp_month INT NOT NULL,
  exp_year INT NOT NULL,
  card_token TEXT NOT NULL,
  authorization_code TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- =====================================================
-- RBAC / Staffing / Security
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id BIGINT REFERENCES vendors(id) ON DELETE CASCADE,
  code VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  hierarchy_level INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, name)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='code') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_code_unique ON roles (code) WHERE code IS NOT NULL';
  END IF;
END $$;


CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100),
  name VARCHAR(255),
  description TEXT,
  category VARCHAR(50),
  resource TEXT,
  action TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='code') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_code_unique ON permissions (code) WHERE code IS NOT NULL';
  END IF;
END $$;


CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_resource_action_unique
  ON permissions (resource, action)
  WHERE resource IS NOT NULL AND action IS NOT NULL;

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS vendor_staff (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT REFERENCES roles(id) ON DELETE SET NULL,
  status vendor_status NOT NULL DEFAULT 'active',
  invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, user_id)
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  department VARCHAR(100),
  manager_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  employment_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'suspended', 'on_leave', 'terminated', 'inactive')),
  password_last_updated_at TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  account_locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS employee_invitations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  invitation_token VARCHAR(255) NOT NULL UNIQUE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  invited_by_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_permission_overrides (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  grant_type VARCHAR(20) NOT NULL DEFAULT 'grant' CHECK (grant_type IN ('grant', 'revoke')),
  scope VARCHAR(50),
  reason TEXT,
  granted_by_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, permission_id, scope)
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  token_type VARCHAR(20) NOT NULL,
  employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  revoked_reason VARCHAR(100),
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  failure_reason VARCHAR(100),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  actor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  description TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT,
  resource TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- Seed Baseline Tenant
-- =====================================================
INSERT INTO tenants (name, slug, plan, status, subscription_status, created_at, updated_at)
VALUES ('Default Organization', 'default', 'enterprise', 'active', 'active', now(), now())
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Automation Triggers
-- =====================================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  counter INT;
BEGIN
  SELECT COUNT(*) + 1 INTO counter
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;

  RETURN 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

CREATE OR REPLACE FUNCTION sync_cart_item_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM carts WHERE id = NEW.cart_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cart_items_set_tenant_id ON cart_items;
CREATE TRIGGER trg_cart_items_set_tenant_id
  BEFORE INSERT OR UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_cart_item_tenant_id();

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tenants_updated ON tenants;
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendors_updated ON vendors;
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_product_variants_updated ON product_variants;
CREATE TRIGGER trg_product_variants_updated BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_variants_updated ON variants;
CREATE TRIGGER trg_variants_updated BEFORE UPDATE ON variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_carts_updated ON carts;
CREATE TRIGGER trg_carts_updated BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cart_items_updated ON cart_items;
CREATE TRIGGER trg_cart_items_updated BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_addresses_updated ON addresses;
CREATE TRIGGER trg_addresses_updated BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated ON payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_saved_cards_updated ON saved_cards;
CREATE TRIGGER trg_saved_cards_updated BEFORE UPDATE ON saved_cards FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_reviews_updated ON reviews;
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_updated ON inventory;
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_roles_updated ON roles;
CREATE TRIGGER trg_roles_updated BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_employees_updated ON employees;
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_employee_invitations_updated ON employee_invitations;
CREATE TRIGGER trg_employee_invitations_updated BEFORE UPDATE ON employee_invitations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- Strategic Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_email_main ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC) WHERE last_login IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON tenant_users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant ON tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON tenant_invitations(email);

CREATE INDEX IF NOT EXISTS idx_vendors_slug_active ON vendors(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON vendors(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_path ON categories USING GIST(path);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_slug_main ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_vendor_main ON products(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_main ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_tenant_user ON carts(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON cart_items(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_tenant_id ON cart_items(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_user_id_main ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_tenant_user ON addresses(tenant_id, user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_main ON orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_currency ON orders(currency);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON orders(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(product_variant_id);

CREATE INDEX IF NOT EXISTS idx_payments_order_id_main ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_id ON payments(stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_product_created ON reviews(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_created ON reviews(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_cards_user ON saved_cards(user_id);

CREATE INDEX IF NOT EXISTS idx_roles_vendor ON roles(vendor_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_vendor_staff_vendor_id ON vendor_staff(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_staff_user_id ON vendor_staff(user_id);

CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_email ON employee_invitations(email);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_status ON employee_invitations(status);
CREATE INDEX IF NOT EXISTS idx_employee_overrides_employee ON employee_permission_overrides(employee_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_security_audit_target ON security_audit_log(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_vendor_created ON audit_logs(vendor_id, created_at DESC) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);

-- =====================================================
-- Row Level Security (Multi-Tenant Isolation)
-- =====================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_tenant_select ON orders;
CREATE POLICY orders_tenant_select ON orders FOR SELECT
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS orders_tenant_insert ON orders;
CREATE POLICY orders_tenant_insert ON orders FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS orders_tenant_update ON orders;
CREATE POLICY orders_tenant_update ON orders FOR UPDATE
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres')
  WITH CHECK (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS orders_tenant_delete ON orders;
CREATE POLICY orders_tenant_delete ON orders FOR DELETE
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS products_tenant_select ON products;
CREATE POLICY products_tenant_select ON products FOR SELECT
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS products_tenant_insert ON products;
CREATE POLICY products_tenant_insert ON products FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS products_tenant_update ON products;
CREATE POLICY products_tenant_update ON products FOR UPDATE
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres')
  WITH CHECK (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS products_tenant_delete ON products;
CREATE POLICY products_tenant_delete ON products FOR DELETE
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS vendors_tenant_select ON vendors;
CREATE POLICY vendors_tenant_select ON vendors FOR SELECT
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS vendors_tenant_insert ON vendors;
CREATE POLICY vendors_tenant_insert ON vendors FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS vendors_tenant_update ON vendors;
CREATE POLICY vendors_tenant_update ON vendors FOR UPDATE
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres')
  WITH CHECK (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS vendors_tenant_delete ON vendors;
CREATE POLICY vendors_tenant_delete ON vendors FOR DELETE
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS categories_tenant_select ON categories;
CREATE POLICY categories_tenant_select ON categories FOR SELECT
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS categories_tenant_insert ON categories;
CREATE POLICY categories_tenant_insert ON categories FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS categories_tenant_update ON categories;
CREATE POLICY categories_tenant_update ON categories FOR UPDATE
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres')
  WITH CHECK (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS categories_tenant_delete ON categories;
CREATE POLICY categories_tenant_delete ON categories FOR DELETE
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres');

DROP POLICY IF EXISTS addresses_tenant_select ON addresses;
CREATE POLICY addresses_tenant_select ON addresses FOR SELECT
  USING ((tenant_id = current_tenant_id() AND user_id = current_user_id()) OR current_user = 'postgres');

DROP POLICY IF EXISTS addresses_tenant_insert ON addresses;
CREATE POLICY addresses_tenant_insert ON addresses FOR INSERT
  WITH CHECK ((tenant_id = current_tenant_id() AND user_id = current_user_id()) OR current_user = 'postgres');

DROP POLICY IF EXISTS addresses_tenant_update ON addresses;
CREATE POLICY addresses_tenant_update ON addresses FOR UPDATE
  USING ((tenant_id = current_tenant_id() AND user_id = current_user_id()) OR current_user = 'postgres')
  WITH CHECK ((tenant_id = current_tenant_id() AND user_id = current_user_id()) OR current_user = 'postgres');

DROP POLICY IF EXISTS addresses_tenant_delete ON addresses;
CREATE POLICY addresses_tenant_delete ON addresses FOR DELETE
  USING ((tenant_id = current_tenant_id() AND user_id = current_user_id()) OR current_user = 'postgres');

DROP POLICY IF EXISTS carts_tenant_select ON carts;
CREATE POLICY carts_tenant_select ON carts FOR SELECT
  USING ((tenant_id = current_tenant_id() AND user_id = current_user_id()) OR current_user = 'postgres');

DROP POLICY IF EXISTS carts_tenant_insert ON carts;
CREATE POLICY carts_tenant_insert ON carts FOR INSERT
  WITH CHECK ((tenant_id = current_tenant_id() AND user_id = current_user_id()) OR current_user = 'postgres');

DROP POLICY IF EXISTS carts_tenant_update ON carts;
CREATE POLICY carts_tenant_update ON carts FOR UPDATE
  USING ((tenant_id = current_tenant_id() AND user_id = current_user_id()) OR current_user = 'postgres')
  WITH CHECK ((tenant_id = current_tenant_id() AND user_id = current_user_id()) OR current_user = 'postgres');

DROP POLICY IF EXISTS carts_tenant_delete ON carts;
CREATE POLICY carts_tenant_delete ON carts FOR DELETE
  USING ((tenant_id = current_tenant_id() AND user_id = current_user_id()) OR current_user = 'postgres');

DROP POLICY IF EXISTS cart_items_tenant_select ON cart_items;
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

DROP POLICY IF EXISTS cart_items_tenant_insert ON cart_items;
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

DROP POLICY IF EXISTS cart_items_tenant_update ON cart_items;
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

DROP POLICY IF EXISTS cart_items_tenant_delete ON cart_items;
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

DROP POLICY IF EXISTS order_items_tenant_select ON order_items;
CREATE POLICY order_items_tenant_select ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );

DROP POLICY IF EXISTS order_items_tenant_insert ON order_items;
CREATE POLICY order_items_tenant_insert ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );

DROP POLICY IF EXISTS order_items_tenant_update ON order_items;
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

DROP POLICY IF EXISTS order_items_tenant_delete ON order_items;
CREATE POLICY order_items_tenant_delete ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );

-- =====================================================
-- Tenant Reporting Views
-- =====================================================
CREATE OR REPLACE VIEW tenant_statistics AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.plan,
  t.status,
  COUNT(DISTINCT tu.user_id) AS user_count,
  COUNT(DISTINCT p.id) AS product_count,
  COUNT(DISTINCT o.id) AS order_count,
  SUM(o.total_cents) / 100.0 AS total_revenue,
  t.created_at
FROM tenants t
LEFT JOIN tenant_users tu ON t.id = tu.tenant_id AND tu.is_active = true
LEFT JOIN products p ON t.id = p.tenant_id AND p.deleted_at IS NULL
LEFT JOIN orders o ON t.id = o.tenant_id AND o.deleted_at IS NULL
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name, t.plan, t.status, t.created_at;

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
