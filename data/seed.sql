-- =====================================================
-- Seed data for the canonical tenant-aware marketplace schema
-- =====================================================
-- This seed intentionally reflects the current baseline in
-- server/infrastructure/database/migrations/025_consolidated_schema_baseline.sql
-- and does not depend on the legacy single-tenant ecommerce schema.

BEGIN;

TRUNCATE TABLE
  audit_logs,
  role_permissions,
  vendor_staff,
  permissions,
  roles,
  reviews,
  payments,
  order_items,
  orders,
  cart_items,
  carts,
  addresses,
  vendors,
  tenant_users,
  tenants,
  users
RESTART IDENTITY CASCADE;

-- =====================================================
-- Tenants
-- =====================================================
INSERT INTO tenants (
  name,
  slug,
  plan,
  status,
  subscription_status,
  primary_contact_email,
  primary_contact_name,
  created_at,
  updated_at
)
VALUES
  ('Default Organization', 'default', 'enterprise', 'active', 'active', 'admin@dealport.local', 'Default Admin', now(), now()),
  ('Aurora Retail Group', 'aurora-retail', 'growth', 'active', 'active', 'aurora@dealport.local', 'Aurora Admin', now(), now()),
  ('Harbor Home Collective', 'harbor-home', 'pro', 'active', 'active', 'harbor@dealport.local', 'Harbor Admin', now(), now());

-- =====================================================
-- Users
-- =====================================================
INSERT INTO users (
  email,
  password_hash,
  role,
  email_verified,
  is_active,
  last_login,
  created_at,
  updated_at
)
VALUES
  ('admin@dealport.local', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', true, true, now() - interval '1 hour', now(), now()),
  ('support@dealport.local', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'support', true, true, now() - interval '2 hour', now(), now());

INSERT INTO users (
  email,
  password_hash,
  role,
  email_verified,
  is_active,
  last_login,
  created_at,
  updated_at
)
SELECT
  format('vendor-owner-%s@dealport.local', lpad(gs::text, 2, '0')),
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'vendor',
  true,
  true,
  now() - (gs || ' hour')::interval,
  now() - (gs || ' hour')::interval,
  now() - (gs || ' hour')::interval
FROM generate_series(1, 6) AS gs;

INSERT INTO users (
  email,
  password_hash,
  role,
  email_verified,
  is_active,
  last_login,
  created_at,
  updated_at
)
SELECT
  format('customer-%s@dealport.local', lpad(gs::text, 3, '0')),
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'customer',
  gs % 3 <> 0,
  true,
  now() - ((gs % 21) || ' day')::interval,
  now() - ((gs % 21) || ' day')::interval,
  now() - ((gs % 21) || ' day')::interval
FROM generate_series(1, 42) AS gs;

-- =====================================================
-- Tenant membership
-- =====================================================
WITH tenant_rows AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM tenants
),
owner_rows AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn
  FROM users
  WHERE email LIKE 'vendor-owner-%@dealport.local'
),
admin_row AS (
  SELECT id FROM users WHERE email = 'admin@dealport.local' LIMIT 1
)
INSERT INTO tenant_users (tenant_id, user_id, role, is_active, invited_by, invited_at, joined_at)
SELECT
  tr.id,
  or_.id,
  'owner',
  true,
  ar.id,
  now() - interval '30 days',
  now() - interval '30 days'
FROM tenant_rows tr
JOIN owner_rows or_ ON or_.rn IN ((tr.rn * 2) - 1, tr.rn * 2)
CROSS JOIN admin_row ar;

WITH customer_rows AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn
  FROM users
  WHERE role = 'customer'
),
tenant_rows AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn, count(*) OVER () AS total_tenants
  FROM tenants
),
admin_row AS (
  SELECT id FROM users WHERE email = 'admin@dealport.local' LIMIT 1
)
INSERT INTO tenant_users (tenant_id, user_id, role, is_active, invited_by, invited_at, joined_at)
SELECT
  tr.id,
  cr.id,
  'member',
  true,
  ar.id,
  now() - ((cr.rn % 12) || ' day')::interval,
  now() - ((cr.rn % 12) || ' day')::interval
FROM customer_rows cr
JOIN tenant_rows tr
  ON tr.rn = ((cr.rn - 1) % tr.total_tenants) + 1
CROSS JOIN admin_row ar;

-- =====================================================
-- Vendors
-- =====================================================
INSERT INTO vendors (user_id, tenant_id, store_name, slug, description, status, created_at, updated_at)
SELECT
  u.id,
  t.id,
  seed.store_name,
  seed.slug,
  seed.description,
  'active',
  now(),
  now()
FROM (
  VALUES
    (1, 'Aurora Atelier', 'aurora-atelier', 'Modern essentials for everyday living'),
    (2, 'Moonlit Goods', 'moonlit-goods', 'Curated goods with a soft premium aesthetic'),
    (3, 'Harbor House', 'harbor-house', 'Household staples and elevated home basics'),
    (4, 'Northline Studio', 'northline-studio', 'Studio pieces for active and urban lifestyles'),
    (5, 'Cedar & Co.', 'cedar-and-co', 'Thoughtful products for relaxed living'),
    (6, 'Summit Supply', 'summit-supply', 'Performance and practical essentials for every day')
) AS seed(rn, store_name, slug, description)
JOIN users u ON u.email = format('vendor-owner-%s@dealport.local', lpad(seed.rn::text, 2, '0'))
JOIN tenants t
  ON t.slug = CASE seed.rn
    WHEN 1 THEN 'default'
    WHEN 2 THEN 'default'
    WHEN 3 THEN 'aurora-retail'
    WHEN 4 THEN 'aurora-retail'
    WHEN 5 THEN 'harbor-home'
    ELSE 'harbor-home'
  END;

-- =====================================================
-- Categories
-- =====================================================
INSERT INTO categories (tenant_id, name, slug, path)
SELECT
  t.id,
  c.name,
  format('%s-%s', t.slug, c.slug),
  (format('%s.%s', t.slug, c.path))::ltree
FROM tenants t
CROSS JOIN (
  VALUES
    ('Fashion', 'fashion', 'fashion'),
    ('Shoes', 'shoes', 'fashion.shoes'),
    ('Beauty', 'beauty', 'beauty'),
    ('Home', 'home', 'home'),
    ('Decor', 'decor', 'home.decor'),
    ('Outdoor', 'outdoor', 'outdoor'),
    ('Accessories', 'accessories', 'accessories')
) AS c(name, slug, path);

-- =====================================================
-- Products
-- =====================================================
INSERT INTO products (
  vendor_id,
  tenant_id,
  category_id,
  name,
  slug,
  brand,
  description,
  material,
  care_instructions,
  image_url,
  base_price,
  is_active,
  created_by,
  updated_by,
  created_at,
  updated_at
)
SELECT
  v.id,
  v.tenant_id,
  c.id,
  seed.name,
  seed.slug,
  v.store_name,
  seed.description,
  seed.material,
  seed.care_instructions,
  seed.image_url,
  seed.base_price,
  true,
  admin.id,
  admin.id,
  now(),
  now()
FROM (
  VALUES
    ('aurora-atelier', 'Fashion', 'Aurora Atelier Everyday Knit', 'aurora-atelier-everyday-knit', 'Soft cotton knit built for all-day comfort.', 'Cotton Blend', 'Machine wash cold. Lay flat to dry.', 'https://images.example.com/aurora-knit.jpg', 4200),
    ('aurora-atelier', 'Fashion', 'Aurora Atelier Weekender Tote', 'aurora-atelier-weekender-tote', 'Structured tote with generous capacity and clean finishes.', 'Canvas', 'Spot clean only. Store in a dust bag.', 'https://images.example.com/aurora-tote.jpg', 5400),
    ('moonlit-goods', 'Beauty', 'Moonlit Glass Serum', 'moonlit-glass-serum', 'Lightweight facial serum formulated for smooth hydration.', 'Glass Bottle', 'Use 2-3 drops morning and evening.', 'https://images.example.com/moonlit-serum.jpg', 3600),
    ('harbor-house', 'Home', 'Harbor House Table Lamp', 'harbor-house-table-lamp', 'Warm ambient lighting for calm evenings at home.', 'Metal', 'Wipe clean with a dry cloth.', 'https://images.example.com/harbor-lamp.jpg', 4800),
    ('northline-studio', 'Shoes', 'Northline Studio Pace Runner', 'northline-studio-pace-runner', 'Responsive everyday runner with a cushioned profile.', 'Mesh', 'Machine wash gentle cycle. Air dry.', 'https://images.example.com/northline-runner.jpg', 6200),
    ('cedar-and-co', 'Decor', 'Cedar & Co. Accent Tray', 'cedar-and-co-accent-tray', 'A compact tray for streamlined styling across rooms.', 'Walnut', 'Dust lightly and wipe with a soft cloth.', 'https://images.example.com/cedar-tray.jpg', 3200),
    ('summit-supply', 'Outdoor', 'Summit Supply Trek Bottle', 'summit-supply-trek-bottle', 'Insulated bottle made for daily hydration on the go.', 'Stainless Steel', 'Wash before first use.', 'https://images.example.com/summit-bottle.jpg', 2900)
) AS seed(vendor_slug, category_name, name, slug, description, material, care_instructions, image_url, base_price)
JOIN vendors v ON v.slug = seed.vendor_slug
JOIN categories c ON c.tenant_id = v.tenant_id AND c.name = seed.category_name
CROSS JOIN (SELECT id FROM users WHERE email = 'admin@dealport.local' LIMIT 1) AS admin;

-- =====================================================
-- Product variants
-- =====================================================
INSERT INTO product_variants (
  product_id,
  sku,
  price_cents,
  stock,
  attributes,
  created_at,
  updated_at
)
SELECT
  p.id,
  format('SKU-%s-%s', p.slug, variant.code),
  p.base_price + variant.delta,
  12 + ((p.id + char_length(variant.code)) % 30),
  jsonb_build_object(
    'size', variant.code,
    'color', variant.color,
    'material', p.material
  ),
  now(),
  now()
FROM products p
CROSS JOIN (
  VALUES
    ('S', 0, 'Sand', 'sand'),
    ('M', 300, 'Navy', 'navy'),
    ('L', 650, 'Black', 'black')
) AS variant(code, delta, color, color_key)
WHERE p.id IN (SELECT id FROM products ORDER BY id LIMIT 21);

-- =====================================================
-- Addresses
-- =====================================================
INSERT INTO addresses (
  user_id,
  tenant_id,
  type,
  first_name,
  last_name,
  email,
  phone,
  street,
  city,
  state,
  postal_code,
  country,
  is_primary,
  created_at,
  updated_at
)
SELECT
  u.id,
  tu.tenant_id,
  'shipping',
  initcap(split_part(u.email, '@', 1)),
  'Customer',
  u.email,
  format('+1-555-%s-%s', lpad((u.id % 900 + 100)::text, 3, '0'), lpad((u.id % 9000 + 1000)::text, 4, '0')),
  format('%s Market Street', 100 + u.id),
  (ARRAY['Austin', 'Seattle', 'New York', 'Denver', 'Chicago', 'Los Angeles'])[(u.id % 6) + 1],
  (ARRAY['TX', 'WA', 'NY', 'CO', 'IL', 'CA'])[(u.id % 6) + 1],
  format('%05s', ((u.id * 17) % 90000) + 1000),
  'US',
  true,
  now() - ((u.id % 30) || ' day')::interval,
  now() - ((u.id % 30) || ' day')::interval
FROM users u
JOIN tenant_users tu ON tu.user_id = u.id AND tu.role = 'member'
ORDER BY u.id
LIMIT 42;

-- =====================================================
-- Carts and cart items
-- =====================================================
INSERT INTO carts (user_id, tenant_id, status, created_at, updated_at)
SELECT
  u.id,
  tu.tenant_id,
  'active',
  now() - ((u.id % 12) || ' day')::interval,
  now() - ((u.id % 12) || ' day')::interval
FROM users u
JOIN tenant_users tu ON tu.user_id = u.id AND tu.role = 'member'
ORDER BY u.id
LIMIT 24;

WITH cart_rows AS (
  SELECT c.id AS cart_id, c.user_id, c.tenant_id, row_number() OVER (ORDER BY c.id) AS rn
  FROM carts c
),
variant_rows AS (
  SELECT pv.id AS variant_id, p.tenant_id, p.id AS product_id, row_number() OVER (ORDER BY pv.id) AS rn
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
)
INSERT INTO cart_items (cart_id, tenant_id, product_id, product_variant_id, quantity, unit_price_cents, created_at, updated_at)
SELECT
  cr.cart_id,
  cr.tenant_id,
  vr.product_id,
  vr.variant_id,
  1 + ((cr.rn + vr.rn) % 2),
  (SELECT price_cents FROM product_variants WHERE id = vr.variant_id),
  now(),
  now()
FROM cart_rows cr
JOIN variant_rows vr ON vr.tenant_id = cr.tenant_id
WHERE cr.rn <= 24
ORDER BY cr.cart_id, vr.variant_id
LIMIT 48;

-- =====================================================
-- Orders
-- =====================================================
INSERT INTO orders (
  user_id,
  tenant_id,
  order_number,
  status,
  payment_status,
  fulfillment_status,
  currency,
  subtotal_cents,
  tax_cents,
  shipping_cents,
  total_cents,
  shipping_first_name,
  shipping_last_name,
  shipping_email,
  shipping_phone,
  shipping_street_address,
  shipping_city,
  shipping_state,
  shipping_postal_code,
  shipping_country,
  created_at,
  updated_at
)
SELECT
  u.id,
  tu.tenant_id,
  format('ORD-%s-%s', to_char(now(), 'YYYYMMDD'), lpad((u.id % 1000)::text, 4, '0')),
  CASE (u.id % 5)
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'paid'
    WHEN 2 THEN 'shipped'
    WHEN 3 THEN 'delivered'
    ELSE 'cancelled'
  END::order_status,
  CASE (u.id % 5)
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'succeeded'
    WHEN 2 THEN 'succeeded'
    WHEN 3 THEN 'succeeded'
    ELSE 'failed'
  END::payment_status,
  CASE (u.id % 4)
    WHEN 0 THEN 'unfulfilled'
    WHEN 1 THEN 'partial'
    WHEN 2 THEN 'fulfilled'
    ELSE 'delivered'
  END,
  'USD',
  2999 + (u.id % 50) * 100,
  240 + (u.id % 8) * 25,
  595,
  2999 + (u.id % 50) * 100 + 240 + (u.id % 8) * 25 + 595,
  a.first_name,
  a.last_name,
  a.email,
  a.phone,
  a.street,
  a.city,
  a.state,
  a.postal_code,
  a.country,
  now() - ((u.id % 21) || ' day')::interval,
  now() - ((u.id % 12) || ' day')::interval
FROM users u
JOIN tenant_users tu ON tu.user_id = u.id AND tu.role = 'member'
JOIN addresses a ON a.user_id = u.id AND a.tenant_id = tu.tenant_id
WHERE u.id <= 24
ORDER BY u.id;

-- =====================================================
-- Order items
-- =====================================================
WITH order_rows AS (
  SELECT o.id AS order_id, o.user_id, o.tenant_id, ROW_NUMBER() OVER (ORDER BY o.id) AS rn
  FROM orders o
),
variant_rows AS (
  SELECT pv.id AS variant_id, p.tenant_id, p.id AS product_id, ROW_NUMBER() OVER (ORDER BY pv.id) AS rn
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
)
INSERT INTO order_items (order_id, product_id, product_variant_id, quantity, unit_price_cents, subtotal_cents, created_at)
SELECT
  or_.order_id,
  vr.product_id,
  vr.variant_id,
  1 + ((or_.rn + vr.rn) % 2),
  1900 + ((or_.rn * 7 + vr.rn) % 1500),
  (1 + ((or_.rn + vr.rn) % 2)) * (1900 + ((or_.rn * 7 + vr.rn) % 1500)),
  now() - ((or_.rn % 15) || ' day')::interval
FROM order_rows or_
JOIN variant_rows vr ON vr.tenant_id = or_.tenant_id
WHERE or_.rn <= 18
ORDER BY or_.order_id, vr.variant_id
LIMIT 36;

-- =====================================================
-- Payments
-- =====================================================
INSERT INTO payments (
  order_id,
  stripe_payment_id,
  processor,
  transaction_id,
  amount_cents,
  currency,
  status,
  metadata,
  created_at,
  updated_at
)
SELECT
  o.id,
  format('pi_mock_%s', lpad(o.id::text, 8, '0')),
  'stripe',
  format('txn_%s', lpad(o.id::text, 8, '0')),
  o.total_cents,
  o.currency,
  CASE o.status
    WHEN 'pending' THEN 'pending'
    WHEN 'cancelled' THEN 'failed'
    ELSE 'succeeded'
  END::payment_status,
  jsonb_build_object('order_number', o.order_number),
  o.created_at + interval '10 minutes',
  o.created_at + interval '10 minutes'
FROM orders o;

-- =====================================================
-- Reviews
-- =====================================================
INSERT INTO reviews (user_id, product_id, rating, title, comment, created_at, updated_at)
SELECT
  u.id,
  p.id,
  ((u.id + p.id) % 5) + 1,
  format('Review %s', p.id),
  'Helpful sample review for product quality and delivery expectations.',
  now() - ((u.id + p.id) % 28 || ' day')::interval,
  now() - ((u.id + p.id) % 20 || ' day')::interval
FROM users u
JOIN tenant_users tu ON tu.user_id = u.id AND tu.role = 'member'
JOIN products p ON p.tenant_id = tu.tenant_id
WHERE u.id <= 18
ORDER BY u.id, p.id
LIMIT 30;

-- =====================================================
-- RBAC + vendor staff
-- =====================================================
INSERT INTO permissions (code, name, description, category, resource, action, is_active, created_at)
VALUES
  ('products:create', 'Create products', 'Create product listings', 'catalog', 'products', 'create', true, now()),
  ('products:read', 'Read products', 'View product listings', 'catalog', 'products', 'read', true, now()),
  ('products:update', 'Update products', 'Edit product listings', 'catalog', 'products', 'update', true, now()),
  ('orders:read', 'Read orders', 'View orders', 'commerce', 'orders', 'read', true, now()),
  ('orders:update', 'Update orders', 'Update order status', 'commerce', 'orders', 'update', true, now()),
  ('inventory:read', 'Read inventory', 'View stock levels', 'inventory', 'inventory', 'read', true, now()),
  ('inventory:update', 'Update inventory', 'Adjust stock levels', 'inventory', 'inventory', 'update', true, now()),
  ('staff:read', 'Read staff', 'View staff roster', 'people', 'staff', 'read', true, now()),
  ('staff:invite', 'Invite staff', 'Invite new users to vendor teams', 'people', 'staff', 'invite', true, now());

INSERT INTO roles (vendor_id, code, name, description, hierarchy_level, is_system, is_active, created_at, updated_at)
SELECT
  v.id,
  format('vendor-%s-owner', lower(replace(v.slug, '-', '_'))),
  'owner',
  'Vendor owner access',
  100,
  true,
  true,
  now(),
  now()
FROM vendors v
UNION ALL
SELECT
  v.id,
  format('vendor-%s-manager', lower(replace(v.slug, '-', '_'))),
  'manager',
  'Operational manager',
  80,
  true,
  true,
  now(),
  now()
FROM vendors v
UNION ALL
SELECT
  v.id,
  format('vendor-%s-support', lower(replace(v.slug, '-', '_'))),
  'support',
  'Customer support agent',
  60,
  true,
  true,
  now(),
  now()
FROM vendors v;

WITH owner_roles AS (
  SELECT r.id AS role_id, r.vendor_id
  FROM roles r
  WHERE r.name = 'owner'
),
permission_ids AS (
  SELECT id FROM permissions
)
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT
  or_.role_id,
  p.id,
  now()
FROM owner_roles or_
CROSS JOIN permission_ids p;

WITH manager_roles AS (
  SELECT r.id AS role_id, r.vendor_id
  FROM roles r
  WHERE r.name = 'manager'
),
manager_perms AS (
  SELECT p.id
  FROM permissions p
  WHERE p.resource IN ('products', 'orders', 'inventory')
)
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT
  mr.role_id,
  mp.id,
  now()
FROM manager_roles mr
JOIN manager_perms mp ON true;

WITH support_roles AS (
  SELECT r.id AS role_id, r.vendor_id
  FROM roles r
  WHERE r.name = 'support'
),
support_perms AS (
  SELECT p.id
  FROM permissions p
  WHERE p.resource IN ('orders', 'products')
    AND p.action IN ('read', 'update')
)
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT
  sr.role_id,
  sp.id,
  now()
FROM support_roles sr
JOIN support_perms sp ON true;

WITH vendor_owner_map AS (
  SELECT v.id AS vendor_id, v.user_id, row_number() OVER (ORDER BY v.id) AS rn
  FROM vendors v
),
role_map AS (
  SELECT r.id AS role_id, r.vendor_id, row_number() OVER (PARTITION BY r.vendor_id ORDER BY r.id) AS rn
  FROM roles r
  WHERE r.name = 'owner'
)
INSERT INTO vendor_staff (vendor_id, user_id, role_id, status, invited_by, created_at)
SELECT
  vom.vendor_id,
  vom.user_id,
  rm.role_id,
  'active',
  (SELECT id FROM users WHERE email = 'admin@dealport.local' LIMIT 1),
  now() - interval '45 days'
FROM vendor_owner_map vom
JOIN role_map rm ON rm.vendor_id = vom.vendor_id AND rm.rn = 1;

WITH vendor_rows AS (
  SELECT v.id AS vendor_id, v.tenant_id, row_number() OVER (ORDER BY v.id) AS rn
  FROM vendors v
),
team_users AS (
  SELECT u.id AS user_id, u.email, row_number() OVER (ORDER BY u.id) AS rn
  FROM users u
  WHERE u.role = 'support'
),
role_map AS (
  SELECT r.id AS role_id, r.vendor_id, r.name,
         ROW_NUMBER() OVER (PARTITION BY r.vendor_id ORDER BY r.id) AS rn
  FROM roles r
  WHERE r.name IN ('manager', 'support')
)
INSERT INTO vendor_staff (vendor_id, user_id, role_id, status, invited_by, created_at)
SELECT
  vr.vendor_id,
  tu.user_id,
  rm.role_id,
  'active',
  (SELECT id FROM users WHERE email = 'admin@dealport.local' LIMIT 1),
  now() - ((vr.rn + tu.rn) || ' day')::interval
FROM vendor_rows vr
JOIN team_users tu ON tu.rn = ((vr.rn * 2) - 1) OR tu.rn = (vr.rn * 2)
JOIN role_map rm ON rm.vendor_id = vr.vendor_id AND rm.rn = 1;

-- =====================================================
-- Audit logs
-- =====================================================
INSERT INTO audit_logs (vendor_id, user_id, action, resource, metadata, created_at)
SELECT
  v.id,
  u.id,
  CASE (u.id % 5)
    WHEN 0 THEN 'create'
    WHEN 1 THEN 'update'
    WHEN 2 THEN 'view'
    WHEN 3 THEN 'delete'
    ELSE 'export'
  END,
  CASE (u.id % 4)
    WHEN 0 THEN 'products'
    WHEN 1 THEN 'orders'
    WHEN 2 THEN 'inventory'
    ELSE 'staff'
  END,
  jsonb_build_object('source', 'seed', 'actor_email', u.email),
  now() - ((u.id % 30) || ' day')::interval
FROM users u
LEFT JOIN vendors v ON v.user_id = u.id
WHERE u.role IN ('admin', 'support', 'vendor')
LIMIT 45;

COMMIT;

SELECT 'tenants' AS table_name, COUNT(*) AS row_count FROM tenants
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'tenant_users', COUNT(*) FROM tenant_users
UNION ALL SELECT 'vendors', COUNT(*) FROM vendors
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'addresses', COUNT(*) FROM addresses
UNION ALL SELECT 'carts', COUNT(*) FROM carts
UNION ALL SELECT 'cart_items', COUNT(*) FROM cart_items
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'permissions', COUNT(*) FROM permissions
UNION ALL SELECT 'role_permissions', COUNT(*) FROM role_permissions
UNION ALL SELECT 'vendor_staff', COUNT(*) FROM vendor_staff
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs;
