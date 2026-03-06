-- =====================================================
-- Extensions
-- =====================================================
CREATE EXTENSION IF NOT EXISTS ltree;

-- =====================================================
-- Enums
-- =====================================================
CREATE TYPE user_role AS ENUM ('customer', 'vendor', 'admin', 'support');
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE address_type AS ENUM ('shipping', 'billing');
CREATE TYPE vendor_status AS ENUM ('active', 'suspended', 'inactive');

-- =====================================================
-- Helper function for updated_at triggers
-- =====================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Core tables
-- =====================================================

-- Users (platform-wide accounts)
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Vendors (each vendor store)
CREATE TABLE vendors (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id),          -- owner
    store_name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    status vendor_status DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Categories with hierarchy (ltree)
CREATE TABLE categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    path LTREE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Products
CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id BIGINT NOT NULL REFERENCES vendors(id),
    category_id BIGINT REFERENCES categories(id),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Product variants (SKU, price_cents, stock, attributes)
CREATE TABLE product_variants (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT UNIQUE NOT NULL,
    price_cents INTEGER NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    attributes JSONB,                     -- e.g. {"size": "M", "color": "red"}
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- User addresses
CREATE TABLE addresses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    street TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Shopping carts
CREATE TABLE carts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cart items
CREATE TABLE cart_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_variant_id BIGINT NOT NULL REFERENCES product_variants(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    UNIQUE (cart_id, product_variant_id)
);

-- Orders
CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    status order_status NOT NULL DEFAULT 'pending',
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    shipping_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Order items (snapshot of product/variant at order time)
CREATE TABLE order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_variant_id BIGINT NOT NULL REFERENCES product_variants(id),
    quantity INT NOT NULL,
    unit_price_cents INTEGER NOT NULL
);

-- Order addresses (shipping/billing snapshots)
CREATE TABLE order_addresses (
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
    country TEXT
);

-- Payments
CREATE TABLE payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    stripe_payment_id TEXT UNIQUE,
    status payment_status NOT NULL,
    amount_cents INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product reviews
CREATE TABLE reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id)
);

-- =====================================================
-- Multi‑vendor RBAC tables
-- =====================================================

-- Roles (per vendor, or global if vendor_id IS NULL)
CREATE TABLE roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id BIGINT REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (vendor_id, name)
);

-- Permissions (global resources & actions)
CREATE TABLE permissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    UNIQUE (resource, action)
);

-- Role ↔ Permission assignments
CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Vendor staff (users with roles inside a vendor)
CREATE TABLE vendor_staff (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    status vendor_status DEFAULT 'active',
    invited_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (vendor_id, user_id)
);

-- Audit log (optional)
CREATE TABLE audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id BIGINT REFERENCES vendors(id),
    user_id BIGINT REFERENCES users(id),
    action TEXT,
    resource TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- Indexes (performance)
-- =====================================================

-- Users
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Vendors
CREATE INDEX idx_vendors_slug ON vendors(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_user_id ON vendors(user_id) WHERE deleted_at IS NULL;

-- Categories
CREATE INDEX idx_categories_path ON categories USING GIST(path);

-- Products
CREATE INDEX idx_products_vendor_id ON products(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category_id ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_active_vendor_category ON products(vendor_id, category_id) WHERE deleted_at IS NULL;

-- Product variants
CREATE INDEX idx_variants_product ON product_variants(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_variants_sku ON product_variants(sku) WHERE deleted_at IS NULL;

-- Addresses
CREATE INDEX idx_addresses_active_user ON addresses(user_id) WHERE deleted_at IS NULL;

-- Orders
CREATE INDEX idx_orders_user_status ON orders(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_created_at ON orders(created_at DESC) WHERE deleted_at IS NULL;

-- Order items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_variant ON order_items(product_variant_id);

-- Payments
CREATE INDEX idx_payments_status_created ON payments(status, created_at);
CREATE INDEX idx_payments_order ON payments(order_id);

-- Reviews
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);

-- RBAC indexes
CREATE INDEX idx_roles_vendor ON roles(vendor_id);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_vendor_staff_vendor ON vendor_staff(vendor_id);
CREATE INDEX idx_vendor_staff_user ON vendor_staff(user_id);
CREATE INDEX idx_vendor_staff_lookup ON vendor_staff(user_id, vendor_id);

-- Audit logs
CREATE INDEX idx_audit_vendor ON audit_logs(vendor_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- Triggers for updated_at
-- =====================================================
CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vendors_updated
    BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- Row Level Security (for multi‑vendor isolation)
-- =====================================================
ALTER TABLE vendor_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: staff can only see rows belonging to their current vendor.
-- The application must set `app.current_vendor` (BIGINT) in the session.
CREATE POLICY vendor_isolation_policy ON vendor_staff
    USING (vendor_id = current_setting('app.current_vendor')::BIGINT);

-- =====================================================
-- Seed data (permissions and system role templates)
-- =====================================================
-- Predefined permissions (global)
INSERT INTO permissions (resource, action) VALUES
    ('products', 'create'),
    ('products', 'read'),
    ('products', 'update'),
    ('products', 'delete'),
    ('orders', 'read'),
    ('orders', 'update'),
    ('orders', 'refund'),
    ('inventory', 'update'),
    ('staff', 'invite'),
    ('staff', 'remove'),
    ('analytics', 'read'),
    ('billing', 'update')
ON CONFLICT DO NOTHING;

-- When a new vendor is created, the application should insert a system 'owner' role
-- and grant all permissions. Example (using placeholders):
/*
INSERT INTO roles (vendor_id, name, is_system)
VALUES (:vendor_id, 'owner', true)
RETURNING id INTO owner_role_id;

INSERT INTO role_permissions (role_id, permission_id)
SELECT owner_role_id, id FROM permissions;
*/