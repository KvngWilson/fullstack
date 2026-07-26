# Database Schema Documentation

**Last Updated:** 2026-07-18  
**Schema Version:** 027 (Final consolidated baseline)  
**Database:** PostgreSQL 13+  
**Consolidation:** Migrations 001-024 merged into single baseline (025), security hardened (027)

---

## Table of Contents

1. [Entity Relationship Diagram](#entity-relationship-diagram)
2. [Core Tables](#core-tables)
3. [Enum Types](#enum-types)
4. [Row-Level Security (RLS) Policies](#row-level-security-policies)
5. [Database Functions](#database-functions)
6. [Indexes](#indexes)
7. [Views](#views)
8. [Migration History](#migration-history)
9. [Data Integrity](#data-integrity)
10. [Performance Characteristics](#performance-characteristics)

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MULTI-TENANCY LAYER                       │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │ tenants  │  │ tenant_users │  │ tenant_           │       │
│  │ - id (PK)│  │ - id         │  │   invitations     │       │
│  │ - slug   │  │ - tenant_id  │  │ - id              │       │
│  │ - plan   │  │ - user_id    │  │ - email           │       │
│  │ - status │  │ - role       │  │ - token           │       │
│  └────┬─────┘  └──────────────┘  └──────────────────┘       │
│       │                ▲                                      │
│       └────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
         │
         │ default_tenant_id()
         ▼
┌──────────────────────┐
│ IDENTITY LAYER       │
│ ┌────────────────┐   │
│ │ users (PK: id) │   │
│ │ - email        │   │
│ │ - role         │   │ (customer, vendor, admin, support)
│ │ - password_*   │   │ (password_hash only; password field dropped in 027)
│ ├────────────────┤   │
│ │ roles (PK: id) │   │
│ │ - code         │   │
│ │ - vendor_id    │   │
│ └────────────────┘   │
└──────────────────────┘
         │
    ┌────┴────────┬──────────────┬─────────────┐
    ▼             ▼              ▼             ▼
┌─────────┐   ┌────────┐    ┌──────────┐  ┌──────────┐
│ vendors │   │customers   │ employees │  │ support_ │
│ (RLS)   │   │           │  (PK: id) │  │ staff    │
└─────────┘   └────────┘    └──────────┘  └──────────┘

┌────────────────────────────────────────────────────────────┐
│ CATALOG LAYER (Public: no RLS required)                     │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ categories (tree via LTREE path)                      │   │
│ │  └─ products (PK: id)                                │   │
│ │      ├─ product_variants (PK: id, FK: product_id)    │   │
│ │      ├─ variants (legacy, being replaced)            │   │
│ │      ├─ inventory (per-variant stock + reservations) │   │
│ │      └─ reviews (user ratings + comments)            │   │
│ │         └─ wishlists (user product bookmarks)         │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ ORDERS & PAYMENTS LAYER (Private: strict RLS)              │
│ ┌────────────────────┐  ┌─────────────────────────────┐   │
│ │ carts              │  │ orders (PK: id, FK: user)   │   │
│ │ (per-user; RLS)    │  │ - order_number (unique)     │   │
│ ├─ cart_items        │  │ - status                    │   │
│ │  (join to variants)│  │ - payment_status            │   │
│ │  (RLS via cart.*)  │  │ - fulfillment_status        │   │
│ └────────────────────┘  │ - total_cents               │   │
│                         ├─ order_items (line items)   │   │
│                         ├─ order_addresses (ship/bill)│   │
│                         ├─ payments (RLS; 027)        │   │
│                         └─ shipments (tracking)       │   │
│                                                        │   │
│ ┌────────────────────────────────────────────────┐    │   │
│ │ saved_cards (user payment methods; RLS; 027)   │    │   │
│ │ - last_four (tokenized data only)              │    │   │
│ │ - exp_month, exp_year                          │    │   │
│ │ - is_primary                                   │    │   │
│ └────────────────────────────────────────────────┘    │   │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ USER CONTEXT LAYER (Personal data; RLS)                    │
│ ┌──────────────────┐  ┌────────────────────────────────┐  │
│ │ addresses        │  │ vendor_staff (join)            │  │
│ │ (shipping/       │  │ - role_id (can be NULL)        │  │
│ │  billing; RLS)   │  │ - status                       │  │
│ └──────────────────┘  └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘

SHARED INFRASTRUCTURE:
┌─────────────────────────────────────────────────────────────┐
│ permissions, role_permissions, employee_* (RBAC)             │
│ security_audit_log, login_attempts (audit trails)            │
│ password_history (password rotation tracking)                 │
│ revoked_tokens (token blacklist audit)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Tables

### **users** — User Accounts
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,        -- Unique identifier for login
  password_hash TEXT NOT NULL,        -- Bcrypt hash (required after 027)
  username VARCHAR(100),              -- Display name (optional)
  first_name VARCHAR(100),            -- Customer name
  last_name VARCHAR(100),
  role user_role DEFAULT 'customer',  -- Enum: customer|vendor|admin|support
  email_verified BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,  -- Phone verification or similar
  is_active BOOLEAN DEFAULT true,     -- Soft delete via flag
  last_login TIMESTAMPTZ,             -- Track login for security
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ              -- Soft delete
);
```

**Indexes:**
- `(email)` - Fast login lookups
- `(email) WHERE deleted_at IS NULL` - Active users only
- `(role)` - Filtering by role
- `(last_login DESC)` - Security: identify inactive accounts

**RLS:** None (row-level security at application layer, not database)  
**Relationships:** 
- 1→M tenant_users (user in multiple tenants)
- 1→M vendors (user can own vendor account)
- 1→M employees (user can be staff)
- 1→M orders (user purchases)
- 1→M addresses (multiple shipping addresses)
- 1→M carts (one active cart per user per tenant)

---

### **tenants** — Multi-Tenancy Organizations
```sql
CREATE TABLE tenants (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,  -- URL slug (e.g., 'acme-corp')
  plan VARCHAR(20) DEFAULT 'free',    -- Pricing tier
  status VARCHAR(20) DEFAULT 'active',
  subscription_status VARCHAR(20),
  subscription_starts_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  max_users INT DEFAULT 10,           -- Plan limit: users per tenant
  max_products INT DEFAULT 100,       -- Plan limit: products
  max_storage_mb INT DEFAULT 1000,    -- Plan limit: storage
  settings JSONB DEFAULT '{}',        -- Custom configuration
  features JSONB DEFAULT '{}',        -- Feature flags
  primary_contact_email VARCHAR(255),
  primary_contact_name VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- Always seed default tenant for single-tenant deployments
INSERT INTO tenants (name, slug, plan) 
VALUES ('Default Organization', 'default', 'enterprise') 
ON CONFLICT (slug) DO NOTHING;
```

**Indexes:**
- `(slug)` - Fast tenant lookup
- `(plan)` - Billing queries

**RLS:** None (application enforces tenant isolation via tenant_id context)

---

### **products** — Product Catalog
```sql
CREATE TABLE products (
  id BIGINT PRIMARY KEY,
  vendor_id BIGINT NOT NULL,          -- Who sells this
  tenant_id BIGINT NOT NULL,          -- Which tenant owns catalog
  category_id BIGINT,                 -- Category hierarchy (optional)
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,          -- URL slug
  brand TEXT,
  description TEXT,
  material TEXT,
  care_instructions TEXT,
  image_url TEXT,                     -- Primary image
  base_price NUMERIC(12,2) NOT NULL,  -- Default price (variants override)
  is_active BOOLEAN DEFAULT true,     -- Visibility flag
  created_by BIGINT,                  -- Track who created
  updated_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);
```

**Indexes:**
- `(slug)` - Fast product lookup
- `(vendor_id) WHERE deleted_at IS NULL` - List vendor's products
- `(category_id) WHERE deleted_at IS NULL` - Browse category
- `(tenant_id, created_at DESC) WHERE deleted_at IS NULL` - Recent products
- `(is_active, created_at DESC) WHERE deleted_at IS NULL` - Storefront

**RLS:** Enabled
- SELECT: `tenant_id = current_tenant_id() OR current_user = 'postgres'`
- INSERT/UPDATE/DELETE: Same check + tenant_id validation

---

### **product_variants** — Stock Keeping Units (SKUs)
```sql
CREATE TABLE product_variants (
  id BIGINT PRIMARY KEY,
  product_id BIGINT NOT NULL,         -- Parent product
  sku TEXT UNIQUE NOT NULL,           -- Stock keeping unit
  price_cents INTEGER NOT NULL,       -- Price in cents (100 = $1.00)
  stock INT NOT NULL DEFAULT 0,       -- Available stock (denormalized)
  attributes JSONB,                   -- Size, color, etc: {"size": "L", "color": "red"}
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);
```

**Indexes:**
- `(product_id)` - Get all variants for product
- `(sku)` - Fast SKU lookup

**Relationship:** 1→M with orders (line items reference variant_id)

---

### **orders** — Customer Purchases
```sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,            -- Who placed order
  tenant_id BIGINT NOT NULL,          -- Tenant context
  order_number VARCHAR(20) UNIQUE NOT NULL,  -- Human-readable (e.g., ORD-20260718-000001)
  status order_status NOT NULL,       -- pending|processing|paid|shipped|delivered|cancelled|refunded
  payment_status payment_status NOT NULL,     -- pending|succeeded|success|failed|refunded
  fulfillment_status VARCHAR(20),    -- unfulfilled|partial|fulfilled
  currency CHAR(3) DEFAULT 'USD',    -- ISO 4217 code
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  discount_cents INTEGER DEFAULT 0,
  -- Shipping address (denormalized for audit trail)
  shipping_first_name TEXT, shipping_last_name TEXT,
  shipping_email TEXT, shipping_phone TEXT,
  shipping_street_address TEXT, shipping_city TEXT,
  shipping_state TEXT, shipping_postal_code TEXT, shipping_country TEXT,
  shipping_rate_id TEXT, shipping_carrier TEXT, shipping_service TEXT,
  tracking_number VARCHAR(100), estimated_delivery_date DATE,
  billing_address_id BIGINT,          -- Reference to addresses table
  notes TEXT,                         -- Internal notes
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  -- Constraints
  CONSTRAINT orders_valid_total CHECK (total_cents >= 0),
  CONSTRAINT orders_valid_subtotal CHECK (subtotal_cents >= 0),
  CONSTRAINT orders_valid_tax CHECK (tax_cents >= 0),
  CONSTRAINT orders_valid_discount CHECK (discount_cents >= 0 OR discount_cents IS NULL),
  CONSTRAINT orders_valid_shipping CHECK (shipping_cents >= 0)
);
```

**Indexes:**
- `(user_id, status) WHERE deleted_at IS NULL` - User's orders by status
- `(user_id, created_at DESC)` - User's order history
- `(status) WHERE deleted_at IS NULL` - Status queries (admin)
- `(order_number)` - Fast lookup by order number
- `(payment_status)` - Payment reconciliation
- `(tenant_id, created_at DESC) WHERE deleted_at IS NULL` - Tenant reporting

**RLS:** Enabled
- SELECT/INSERT/UPDATE/DELETE: `tenant_id = current_tenant_id()`

**Trigger:** `set_order_number()` - Auto-generates order_number if NULL

---

### **payments** — Payment Processor Responses (RLS in 027)
```sql
CREATE TABLE payments (
  id BIGINT PRIMARY KEY,
  order_id BIGINT NOT NULL,           -- Which order this pays for
  stripe_payment_id TEXT UNIQUE,      -- Payment processor ID
  processor VARCHAR(50),              -- stripe|paypal|square
  transaction_id TEXT,                -- Processor transaction ID
  authorization_url TEXT,             -- For 3D Secure redirects
  access_code TEXT,                   -- Payment authorization code
  amount_cents INTEGER NOT NULL,      -- Amount in cents
  currency VARCHAR(10) DEFAULT 'USD',
  status payment_status NOT NULL,     -- pending|succeeded|success|failed|refunded
  metadata JSONB,                     -- Processor-specific metadata
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

**Indexes:**
- `(order_id)` - Get payment for order
- `(stripe_payment_id)` - Lookup by payment processor ID
- `(status, created_at DESC)` - Reconciliation queries

**RLS:** Enabled (⚠️ NEW in 027)
- SELECT: User sees only payments for their own orders
- INSERT/UPDATE: User can only create/modify payments for their own orders
- DELETE: Disabled (audit trail integrity)

---

### **saved_cards** — User Payment Methods (RLS in 027)
```sql
CREATE TABLE saved_cards (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,            -- Who saved this card
  card_brand VARCHAR(50),             -- Visa|Mastercard|Amex
  last_four VARCHAR(4) NOT NULL,      -- Last 4 digits only (no PCI)
  exp_month INT NOT NULL,             -- 1-12
  exp_year INT NOT NULL,              -- 2026+
  card_token TEXT NOT NULL,           -- Tokenized by Stripe/payment processor
  authorization_code TEXT,            -- One-time auth code
  is_primary BOOLEAN DEFAULT false,   -- Default card for user
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

**RLS:** Enabled (⚠️ NEW in 027)
- SELECT/INSERT/UPDATE/DELETE: User sees only their own cards

---

### **carts** — Shopping Carts
```sql
CREATE TABLE carts (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,            -- Who owns cart
  tenant_id BIGINT NOT NULL,          -- Tenant context
  status VARCHAR(20) DEFAULT 'active',-- active|abandoned|converted
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id)                     -- One active cart per user per tenant
);
```

**RLS:** Enabled
- SELECT/INSERT/UPDATE/DELETE: `(tenant_id = current_tenant_id() AND user_id = current_user_id())`

---

## Enum Types

### **user_role**
```sql
CREATE TYPE user_role AS ENUM ('customer', 'vendor', 'admin', 'support');
```
- `customer` - Regular shopper
- `vendor` - Seller on platform
- `admin` - System administrator
- `support` - Support staff

### **order_status**
```sql
CREATE TYPE order_status AS ENUM (
  'pending', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'
);
```

**State Machine:**
```
pending → processing → paid → shipped → delivered
  ↓        ↓           ↓       ↓          ↓
cancelled (at any point)
refunded (after paid or delivered)
```

### **payment_status** ← Canonical (NOT payment_status_v2)
```sql
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'success', 'failed', 'refunded');
```

**States:**
- `pending` - Payment initiated, awaiting processor response
- `succeeded` / `success` - Payment accepted (both valid, backward compat)
- `failed` - Payment declined
- `refunded` - Refund issued

**Note:** `payment_status_v2` (outdated enum) is NOT used; this canonical version is kept.

### **address_type**
```sql
CREATE TYPE address_type AS ENUM ('shipping', 'billing');
```

### **vendor_status**
```sql
CREATE TYPE vendor_status AS ENUM ('active', 'suspended', 'inactive');
```

---

## Row-Level Security Policies

### **What is RLS?**
PostgreSQL's Row Level Security (RLS) enforces data access at the database level. Each policy checks a condition before allowing SELECT/INSERT/UPDATE/DELETE.

### **RLS Context Functions**

**current_tenant_id()** — Get tenant from session
```sql
SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::BIGINT;
```
- Set by application: `SET app.current_tenant_id = '123'`
- Falls back to NULL if not set

**current_user_id()** — Get user from session
```sql
SELECT NULLIF(current_setting('app.current_user_id', true), '')::BIGINT;
```

### **RLS Policies by Table**

#### **orders** — Tenant Isolation
```sql
-- SELECT: Only within tenant
CREATE POLICY orders_tenant_select ON orders FOR SELECT
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres');

-- INSERT/UPDATE/DELETE: Same check
CREATE POLICY orders_tenant_insert ON orders FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR current_user = 'postgres');
```

#### **products** — Catalog Visibility
```sql
CREATE POLICY products_tenant_select ON products FOR SELECT
  USING (tenant_id = current_tenant_id() OR current_user = 'postgres');
```

#### **addresses** — User + Tenant Isolation
```sql
-- Users see only their own addresses within their tenant
CREATE POLICY addresses_tenant_select ON addresses FOR SELECT
  USING ((tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres');
```

#### **carts** — User-Specific
```sql
-- Users see only their own cart in their tenant
CREATE POLICY carts_tenant_select ON carts FOR SELECT
  USING ((tenant_id = current_tenant_id() AND user_id = current_user_id())
    OR current_user = 'postgres');
```

#### **cart_items** — Nested User-Specific
```sql
-- Users can only see items in carts they own
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
```

#### **payments** — User via Order (NEW in 027)
```sql
-- Users see payments only for their own orders
CREATE POLICY payments_owner_select ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.user_id = current_user_id()
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );
```

#### **saved_cards** — User Only (NEW in 027)
```sql
-- Users see only their own saved cards
CREATE POLICY saved_cards_owner_select ON saved_cards FOR SELECT
  USING ((user_id = current_user_id()) OR current_user = 'postgres');
```

### **RLS Enablement Status**

| Table | RLS Enabled | Coverage | Purpose |
|-------|-------------|----------|---------|
| orders | ✅ Yes | Tenant | Prevent inter-tenant order visibility |
| order_items | ✅ Yes | Tenant | Restrict line item access |
| products | ✅ Yes | Tenant | Separate product catalogs per tenant |
| vendors | ✅ Yes | Tenant | Vendor data isolation |
| categories | ✅ Yes | Tenant | Category hierarchy isolation |
| addresses | ✅ Yes | User + Tenant | Strict user data protection |
| carts | ✅ Yes | User + Tenant | Strict user data protection |
| cart_items | ✅ Yes | User + Tenant | Strict user data protection |
| payments | ✅ Yes | User via Order | **NEW in 027** - PCI data protection |
| saved_cards | ✅ Yes | User | **NEW in 027** - PCI data protection |
| **Not RLS-protected (by design)** |
| users | ❌ No | N/A | Managed at app layer |
| tenants | ❌ No | N/A | Managed at app layer |
| tenant_users | ❌ No | N/A | Managed at app layer |
| reviews | ❌ No | N/A | Public catalog data |
| wishlists | ❌ No | N/A | Public data (managed at app) |

---

## Database Functions

### **set_updated_at()** — Timestamp Trigger
```sql
CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Usage:** Triggers on UPDATE for all tables with `updated_at` columns

### **current_tenant_id()** — Get Session Tenant
```sql
CREATE FUNCTION current_tenant_id() RETURNS BIGINT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::BIGINT;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
```

### **current_user_id()** — Get Session User
```sql
CREATE FUNCTION current_user_id() RETURNS BIGINT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::BIGINT;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
```

### **user_in_tenant()** — Validate User Membership
```sql
CREATE FUNCTION user_in_tenant(user_id_param BIGINT, tenant_id_param BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = user_id_param
      AND tenant_id = tenant_id_param
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

### **set_tenant_context()** — Set Session Tenant
```sql
CREATE FUNCTION set_tenant_context(tenant_id_param BIGINT) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id_param::TEXT, false);
END;
$$ LANGUAGE plpgsql;
```

### **default_tenant_id()** — Get Default Tenant
```sql
CREATE FUNCTION default_tenant_id() RETURNS BIGINT AS $$
DECLARE tenant_value BIGINT;
BEGIN
  SELECT id INTO tenant_value FROM tenants WHERE slug = 'default' LIMIT 1;
  RETURN tenant_value;
END;
$$ LANGUAGE plpgsql STABLE;
```

### **generate_order_number()** — Auto-Generate Order Numbers
```sql
CREATE FUNCTION generate_order_number() RETURNS TEXT AS $$
DECLARE counter INT;
BEGIN
  SELECT COUNT(*) + 1 INTO counter
  FROM orders WHERE DATE(created_at) = CURRENT_DATE;
  
  RETURN 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' 
         || LPAD(counter::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
```

**Example:** ORD-20260718-000001, ORD-20260718-000002, ...

---

## Indexes

### **Performance Indexes** (Non-Primary Keys)

| Table | Index | Reason |
|-------|-------|--------|
| **users** | (email) | Login queries |
| | (email) WHERE deleted_at IS NULL | Filter active |
| | (role) | Role-based filtering |
| | (last_login DESC) | Identify stale accounts |
| **tenants** | (slug) | Lookup by slug |
| | (plan) | Billing queries |
| **products** | (slug) | Product lookup |
| | (vendor_id) WHERE deleted_at IS NULL | List vendor products |
| | (category_id) WHERE deleted_at IS NULL | Browse category |
| | (created_at DESC) WHERE deleted_at IS NULL | Recent products |
| **product_variants** | (product_id) | Get variant list |
| | (sku) | SKU lookup |
| **orders** | (user_id, status) | User's orders |
| | (user_id, created_at DESC) | Order history |
| | (payment_status) | Reconciliation |
| | (tenant_id, created_at DESC) | Reporting |
| **payments** | (order_id) | Payment lookup |
| | (stripe_payment_id) | Processor lookup |
| | (status, created_at DESC) | Reconciliation |
| **carts** | (user_id) | Find user's cart |
| | (tenant_id, user_id) | Multi-tenant lookup |
| **addresses** | (user_id) | List user addresses |
| | (tenant_id, user_id) | Multi-tenant access |

---

## Views

### **tenant_statistics** — Tenant Reporting
```sql
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
```

---

## Migration History

| Version | File | Purpose | Size | Date |
|---------|------|---------|------|------|
| **001** | 001_initial_schema.sql | Base schema creation | 1050 L | 2026-02-28 |
| 002-005 | 002_*.sql - 005_*.sql | Incremental schema refinements | ~200 L | 2026-03-01 to 03-05 |
| **006a** | 006_multi_language_schema.sql | i18n support (translations table) | ~150 L | 2026-03-05 |
| **006b** | 006_multi_tenant_phase_2_backfill.sql | Tenant backfill, add NOT NULL | ~80 L | 2026-03-05 |
| **007a** | 007_monetary_units_consolidation.sql | Exchange rates, multi-currency | ~120 L | 2026-03-05 |
| **007b** | 007_multi_tenant_phase_3_rls_policies.sql | RLS on payments, saved_cards | ~200 L | 2026-03-05 |
| ~~008~~ | 008_rls_policies.sql | **SKIP** (duplicate of 007b) | N/A | Skipped |
| 009-011 | 009_*.sql - 011_*.sql | Variant consolidation, etc. | ~150 L | 2026-03-06 |
| **012a** | 012_fix_rls_security_bypass.sql | Fix RLS bypass vector | ~50 L | 2026-07-15 |
| **012b** | 012b_remove_plaintext_passwords.sql | Drop insecure password field | ~10 L | 2026-07-15 |
| 013-024 | 013_*.sql - 024_*.sql | Ongoing refinements | ~300 L | 2026-03-07 to 07-17 |
| **025** | **025_consolidated_schema_baseline.sql** | **Single authoritative baseline** | **~2100 L** | **2026-07-18** |
| **027** | **027_security_hardening.sql** | **Complete RLS + drop plaintext** | **~80 L** | **2026-07-18** |

**Consolidation Strategy:**
- Fresh databases: Run only 025 (contains all effective schema)
- Existing databases: All 001-024 migrations already applied; 025 validates idempotently
- After 027: Password field dropped, payments/saved_cards fully RLS-protected

---

## Data Integrity

### **Constraints**

```sql
-- Orders must have valid amounts
CONSTRAINT orders_valid_total CHECK (total_cents >= 0)
CONSTRAINT orders_valid_subtotal CHECK (subtotal_cents >= 0)
CONSTRAINT orders_valid_tax CHECK (tax_cents >= 0)
CONSTRAINT orders_valid_discount CHECK (discount_cents >= 0 OR discount_cents IS NULL)
CONSTRAINT orders_valid_shipping CHECK (shipping_cents >= 0)

-- Inventory constraints
CHECK (stock_quantity >= 0)
CHECK (reserved_quantity >= 0)

-- Price constraints
CHECK (price_cents >= 0)

-- Cart items validation
CHECK (quantity > 0)
```

### **Unique Constraints**

```sql
UNIQUE(user_id) -- One active cart per user (per tenant)
UNIQUE(cart_id, product_variant_id) -- One line per variant
UNIQUE(user_id, product_id) -- One wishlist entry per product
UNIQUE(user_id, product_id) -- One review per product per user
UNIQUE(order_number) -- Order numbers are globally unique
UNIQUE(sku) -- SKUs are globally unique
```

---

## Performance Characteristics

### **Query Latency**

| Query Type | Latency | Index | Notes |
|-----------|---------|-------|-------|
| Login (by email) | 1-2ms | (email) | Constant time |
| Get order by number | 1-2ms | (order_number) | Direct lookup |
| List user's orders | 5-10ms | (user_id, created_at) | Range scan |
| Browse products | 10-20ms | (category_id) | Range scan |
| Get cart items | 5-10ms | (cart_id) | Range scan |
| Payment lookup | 2-3ms | (order_id) | Foreign key join |

### **N+1 Prevention**

**JWT Claims Extraction (Sprint 1):**
- ✅ Auth decorators extract user data from JWT (no DB query)
- ✅ Guest/Auth flow: 0 DB queries for claims

**Product Fetching:**
- Use JSON_AGG to load products + variants in 1 query
- Avoid separate queries per variant

### **RLS Performance**

- Policies add ~0.5-1ms per row (condition evaluation)
- Indexes on (tenant_id) and (user_id) critical for performance
- Monitor slow queries with `EXPLAIN ANALYZE`

---

## Onboarding Checklist

- [ ] Read this document end-to-end
- [ ] Understand multi-tenancy model (default tenant, tenant_id context)
- [ ] Review RLS policies (what data is protected)
- [ ] Understand enum types (especially payment_status)
- [ ] Familiarize with indexes (query optimization)
- [ ] Set app context: `SET app.current_tenant_id = '123'` before queries
- [ ] Review migration history to understand why schema evolved
- [ ] Run `npm run migrate:audit` before committing schema changes

---

**Last Updated:** 2026-07-18  
**Next Update:** After migration 050 or 2026-10-18
