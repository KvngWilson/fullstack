-- =====================================================
-- Seed Data (large sample) for current schema in queries.sql
-- =====================================================
-- Safe to re-run: truncates transactional/domain data and reseeds.

BEGIN;

-- =====================================================
-- Reset data (in dependency-safe order)
-- =====================================================
TRUNCATE TABLE
  audit_logs,
  vendor_staff,
  role_permissions,
  roles,
  payments,
  order_addresses,
  order_items,
  order_exchange_rates,
  orders,
  cart_items,
  carts,
  reviews,
  product_variants,
  products,
  categories,
  exchange_rates,
  system_config,
  permissions,
  addresses,
  vendors,
  users
RESTART IDENTITY CASCADE;

-- =====================================================
-- Users
-- =====================================================
INSERT INTO users (email, password_hash, role, email_verified, is_active, last_login)
VALUES
  ('admin@dealport.local',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',   true, true, now() - interval '1 hour'),
  ('support@dealport.local', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'support', true, true, now() - interval '2 hour');

INSERT INTO users (email, password_hash, role, email_verified, is_active, last_login)
SELECT
  format('vendor-owner-%s@dealport.local', lpad(gs::text, 2, '0')),
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'vendor',
  true,
  true,
  now() - (gs || ' hour')::interval
FROM generate_series(1, 10) gs;

INSERT INTO users (email, password_hash, role, email_verified, is_active, last_login)
SELECT
  format('vendor-staff-%s@dealport.local', lpad(gs::text, 2, '0')),
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'support',
  true,
  true,
  now() - (gs || ' day')::interval
FROM generate_series(1, 40) gs;

INSERT INTO users (email, password_hash, role, email_verified, is_active, last_login)
SELECT
  format('customer-%s@dealport.local', lpad(gs::text, 3, '0')),
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'customer',
  (gs % 3) <> 0,
  true,
  now() - ((gs % 30) || ' day')::interval
FROM generate_series(1, 180) gs;

-- =====================================================
-- Vendors
-- =====================================================
WITH owner_users AS (
  SELECT id, email, row_number() OVER (ORDER BY id) AS rn
  FROM users
  WHERE email LIKE 'vendor-owner-%@dealport.local'
),
vendor_seed AS (
  SELECT * FROM (VALUES
    (1, 'Aurora Fashion House',      'aurora-fashion-house',      'Modern apparel and premium wardrobe staples'),
    (2, 'Northline Footwear',        'northline-footwear',        'Contemporary shoes and seasonal drops'),
    (3, 'Lumen Beauty Collective',   'lumen-beauty-collective',   'Skincare and cosmetics with clean formulas'),
    (4, 'Verve Accessories',         'verve-accessories',         'Curated accessories and lifestyle accents'),
    (5, 'Summit Tech Boutique',      'summit-tech-boutique',      'Consumer electronics and smart essentials'),
    (6, 'Atlas Outdoor Supply',      'atlas-outdoor-supply',      'Travel and outdoor-ready product lines'),
    (7, 'Harbor Home Goods',         'harbor-home-goods',         'Home organization and decor essentials'),
    (8, 'Meridian Jewelry Studio',   'meridian-jewelry-studio',   'Handcrafted jewelry and statement pieces'),
    (9, 'Pulse Activewear',          'pulse-activewear',          'Performance apparel and training gear'),
    (10, 'Cedar Kids Corner',        'cedar-kids-corner',         'Kids apparel, toys, and family picks')
  ) AS t(rn, store_name, slug, description)
)
INSERT INTO vendors (user_id, store_name, slug, description, status)
SELECT o.id, v.store_name, v.slug, v.description, 'active'
FROM vendor_seed v
JOIN owner_users o ON o.rn = v.rn;

-- =====================================================
-- Categories (ltree hierarchy)
-- =====================================================
INSERT INTO categories (name, slug, path)
VALUES
  ('Fashion',        'fashion',        'fashion'),
  ('Shoes',          'shoes',          'fashion.shoes'),
  ('Activewear',     'activewear',     'fashion.activewear'),
  ('Bags',           'bags',           'fashion.bags'),
  ('Beauty',         'beauty',         'beauty'),
  ('Skincare',       'skincare',       'beauty.skincare'),
  ('Makeup',         'makeup',         'beauty.makeup'),
  ('Accessories',    'accessories',    'accessories'),
  ('Jewelry',        'jewelry',        'accessories.jewelry'),
  ('Electronics',    'electronics',    'electronics'),
  ('Audio',          'audio',          'electronics.audio'),
  ('Mobile',         'mobile',         'electronics.mobile'),
  ('Home',           'home',           'home'),
  ('Decor',          'decor',          'home.decor'),
  ('Kitchen',        'kitchen',        'home.kitchen'),
  ('Outdoor',        'outdoor',        'outdoor'),
  ('Travel',         'travel',         'outdoor.travel'),
  ('Kids',           'kids',           'kids'),
  ('Toys',           'toys',           'kids.toys'),
  ('School',         'school',         'kids.school');

-- =====================================================
-- Products (160)
-- =====================================================
WITH vendor_pool AS (
  SELECT id, row_number() OVER (ORDER BY id) rn, count(*) OVER () total
  FROM vendors
),
category_pool AS (
  SELECT id, slug, row_number() OVER (ORDER BY id) rn, count(*) OVER () total
  FROM categories
),
name_words AS (
  SELECT * FROM (VALUES
    (1, 'Essential'), (2, 'Premium'), (3, 'Everyday'), (4, 'Classic'),
    (5, 'Modern'), (6, 'Signature'), (7, 'Studio'), (8, 'Heritage'),
    (9, 'Urban'), (10, 'Summit'), (11, 'Harbor'), (12, 'Luxe')
  ) AS t(id, word)
)
INSERT INTO products (vendor_id, category_id, name, slug, description, created_at, updated_at)
SELECT
  vp.id,
  cp.id,
  format('%s %s Item %s', nw.word, initcap(replace(cp.slug, '-', ' ')), lpad(gs::text, 3, '0')),
  format('%s-item-%s', cp.slug, lpad(gs::text, 3, '0')),
  format(
    'Sample catalog product %s in %s from vendor %s. Designed for realistic browsing, sorting, and checkout test flows.',
    lpad(gs::text, 3, '0'),
    cp.slug,
    vp.id
  ),
  now() - ((gs % 45) || ' day')::interval,
  now() - ((gs % 10) || ' day')::interval
FROM generate_series(1, 160) gs
JOIN vendor_pool vp ON vp.rn = ((gs - 1) % vp.total) + 1
JOIN category_pool cp ON cp.rn = ((gs - 1) % cp.total) + 1
JOIN name_words nw ON nw.id = ((gs - 1) % 12) + 1;

-- =====================================================
-- Product variants (~480, 3 per product)
-- =====================================================
WITH sizes AS (
  SELECT * FROM (VALUES (1, 'S'), (2, 'M'), (3, 'L')) AS t(pos, size_code)
),
colors AS (
  SELECT * FROM (VALUES
    (1, 'Black'),
    (2, 'White'),
    (3, 'Navy'),
    (4, 'Olive'),
    (5, 'Sand'),
    (6, 'Rose')
  ) AS t(pos, color_name)
)
INSERT INTO product_variants
  (product_id, sku, price_cents, price_minor_units, currency_code, currency, stock, attributes, created_at)
SELECT
  p.id,
  format('SKU-%s-%s-%s', lpad(p.id::text, 5, '0'), s.size_code, lpad(s.pos::text, 2, '0')),
  (1999 + ((p.id % 80) * 175) + (s.pos * 125))::int,
  (1999 + ((p.id % 80) * 175) + (s.pos * 125))::int,
  CASE (p.id % 4) WHEN 0 THEN 'USD' WHEN 1 THEN 'EUR' WHEN 2 THEN 'GBP' ELSE 'CAD' END,
  CASE (p.id % 4) WHEN 0 THEN 'USD' WHEN 1 THEN 'EUR' WHEN 2 THEN 'GBP' ELSE 'CAD' END,
  (8 + ((p.id + s.pos) % 60))::int,
  jsonb_build_object(
    'size', s.size_code,
    'color', c.color_name,
    'material', CASE WHEN (p.id % 3) = 0 THEN 'Cotton Blend' WHEN (p.id % 3) = 1 THEN 'Leather' ELSE 'Polyester' END
  ),
  now() - ((p.id % 25) || ' day')::interval
FROM products p
JOIN sizes s ON true
JOIN colors c ON c.pos = ((p.id + s.pos) % 6) + 1;

-- =====================================================
-- Addresses (for customers and vendor owners)
-- =====================================================
INSERT INTO addresses
  (user_id, first_name, last_name, phone, street, city, state, postal_code, country, created_at)
SELECT
  u.id,
  CASE
    WHEN u.role = 'customer' THEN format('Customer%s', lpad((row_number() OVER (ORDER BY u.id))::text, 3, '0'))
    ELSE format('Vendor%s', lpad((row_number() OVER (ORDER BY u.id))::text, 2, '0'))
  END,
  'User',
  format('+1-555-%s-%s', lpad((u.id % 900 + 100)::text, 3, '0'), lpad((u.id % 9000 + 1000)::text, 4, '0')),
  format('%s Market Street', 100 + u.id),
  (ARRAY['New York','Austin','Seattle','Los Angeles','Chicago','Denver'])[(u.id % 6) + 1],
  (ARRAY['NY','TX','WA','CA','IL','CO'])[(u.id % 6) + 1],
  format('%05s', (10000 + u.id)::text),
  'US',
  now() - ((u.id % 120) || ' day')::interval
FROM users u
WHERE u.role IN ('customer', 'vendor');

-- =====================================================
-- Carts + cart items
-- =====================================================
INSERT INTO carts (user_id, created_at)
SELECT u.id, now() - ((u.id % 20) || ' day')::interval
FROM users u
WHERE u.role = 'customer'
ORDER BY u.id
LIMIT 120;

WITH cart_pool AS (
  SELECT id, row_number() OVER (ORDER BY id) rn
  FROM carts
),
variant_pool AS (
  SELECT id, row_number() OVER (ORDER BY id) rn, count(*) OVER () total
  FROM product_variants
)
INSERT INTO cart_items (cart_id, product_variant_id, quantity)
SELECT
  c.id,
  vp.id,
  ((c.rn + line.n) % 4) + 1
FROM cart_pool c
CROSS JOIN generate_series(1, 4) AS line(n)
JOIN variant_pool vp ON vp.rn = ((c.rn * 13 + line.n * 17) % vp.total) + 1;

-- =====================================================
-- Orders + items + addresses + payments
-- =====================================================
WITH customer_pool AS (
  SELECT id, row_number() OVER (ORDER BY id) rn, count(*) OVER () total
  FROM users
  WHERE role = 'customer'
)
INSERT INTO orders
  (user_id, status, currency, subtotal_cents, tax_cents, shipping_cents, total_cents, created_at, updated_at)
SELECT
  cp.id,
  CASE (gs % 6)
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'paid'
    WHEN 2 THEN 'shipped'
    WHEN 3 THEN 'delivered'
    WHEN 4 THEN 'cancelled'
    ELSE 'refunded'
  END::order_status,
  CASE (gs % 4)
    WHEN 0 THEN 'USD'
    WHEN 1 THEN 'EUR'
    WHEN 2 THEN 'GBP'
    ELSE 'CAD'
  END,
  0,
  0,
  0,
  0,
  now() - ((gs % 50) || ' day')::interval,
  now() - ((gs % 12) || ' day')::interval
FROM generate_series(1, 260) gs
JOIN customer_pool cp ON cp.rn = ((gs - 1) % cp.total) + 1;

WITH order_pool AS (
  SELECT id, currency, row_number() OVER (ORDER BY id) rn
  FROM orders
),
currency_variants AS (
  SELECT id, price_cents, currency, row_number() OVER (PARTITION BY currency ORDER BY id) rn
  FROM product_variants
),
currency_counts AS (
  SELECT currency, count(*) AS total
  FROM product_variants
  GROUP BY currency
)
INSERT INTO order_items (order_id, product_variant_id, quantity, unit_price_cents)
SELECT
  o.id,
  cv.id,
  ((o.rn + line.n) % 3) + 1,
  cv.price_cents
FROM order_pool o
CROSS JOIN generate_series(1, 2) AS line(n)
JOIN currency_counts cc ON cc.currency = o.currency
JOIN currency_variants cv
  ON cv.currency = o.currency
 AND cv.rn = ((o.rn * 7 + line.n * 11) % cc.total) + 1;

UPDATE orders o
SET
  subtotal_cents = totals.subtotal_cents,
  tax_cents = totals.tax_cents,
  shipping_cents = totals.shipping_cents,
  total_cents = totals.subtotal_cents + totals.tax_cents + totals.shipping_cents,
  exchange_rate_at_time = CASE WHEN o.currency = 'USD' THEN 1.00000000 ELSE 1.12000000 END
FROM (
  SELECT
    oi.order_id,
    sum(oi.unit_price_cents * oi.quantity)::int AS subtotal_cents,
    round(sum(oi.unit_price_cents * oi.quantity) * 0.08)::int AS tax_cents,
    CASE WHEN sum(oi.unit_price_cents * oi.quantity) >= 20000 THEN 0 ELSE 999 END AS shipping_cents
  FROM order_items oi
  GROUP BY oi.order_id
) totals
WHERE o.id = totals.order_id;

INSERT INTO order_addresses
  (order_id, type, first_name, last_name, email, phone, street, city, state, postal_code, country)
SELECT
  o.id,
  'shipping',
  a.first_name,
  a.last_name,
  u.email,
  a.phone,
  a.street,
  a.city,
  a.state,
  a.postal_code,
  a.country
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN LATERAL (
  SELECT first_name, last_name, phone, street, city, state, postal_code, country
  FROM addresses
  WHERE user_id = o.user_id
  ORDER BY id
  LIMIT 1
) a ON true;

INSERT INTO order_addresses
  (order_id, type, first_name, last_name, email, phone, street, city, state, postal_code, country)
SELECT
  oa.order_id,
  'billing',
  oa.first_name,
  oa.last_name,
  oa.email,
  oa.phone,
  oa.street,
  oa.city,
  oa.state,
  oa.postal_code,
  oa.country
FROM order_addresses oa
WHERE oa.type = 'shipping';

INSERT INTO payments (order_id, stripe_payment_id, status, amount_cents, created_at)
SELECT
  o.id,
  format('pi_mock_%s', lpad(o.id::text, 8, '0')),
  CASE o.status
    WHEN 'pending' THEN 'pending'
    WHEN 'cancelled' THEN 'failed'
    WHEN 'refunded' THEN 'refunded'
    ELSE 'succeeded'
  END::payment_status,
  o.total_cents,
  o.created_at + interval '10 minutes'
FROM orders o;

-- =====================================================
-- Reviews
-- =====================================================
WITH customer_pool AS (
  SELECT id AS user_id, row_number() OVER (ORDER BY id) rn
  FROM users
  WHERE role = 'customer'
),
product_pool AS (
  SELECT id AS product_id, row_number() OVER (ORDER BY id) rn
  FROM products
)
INSERT INTO reviews (user_id, product_id, rating, comment, created_at)
SELECT
  c.user_id,
  p.product_id,
  ((c.rn + p.rn) % 5) + 1,
  format('Review by customer %s on product %s. Sample feedback for UX, sorting, and moderation tests.', c.rn, p.rn),
  now() - (((c.rn + p.rn) % 120) || ' day')::interval
FROM customer_pool c
JOIN product_pool p ON ((c.rn * 3 + p.rn * 5) % 17) = 0;

-- =====================================================
-- RBAC: permissions, roles, mappings, staff
-- =====================================================
INSERT INTO permissions (resource, action)
VALUES
  ('products', 'create'),
  ('products', 'read'),
  ('products', 'update'),
  ('products', 'delete'),
  ('categories', 'read'),
  ('orders', 'read'),
  ('orders', 'update'),
  ('orders', 'refund'),
  ('inventory', 'read'),
  ('inventory', 'update'),
  ('staff', 'invite'),
  ('staff', 'read'),
  ('staff', 'update'),
  ('staff', 'remove'),
  ('analytics', 'read'),
  ('billing', 'read'),
  ('billing', 'update'),
  ('support', 'ticket-read'),
  ('support', 'ticket-update'),
  ('settings', 'update');

INSERT INTO roles (vendor_id, name, is_system)
SELECT v.id, role_name, is_system
FROM vendors v
CROSS JOIN (VALUES
  ('owner', true),
  ('manager', true),
  ('support', true),
  ('warehouse', true),
  ('finance', true)
) AS r(role_name, is_system);

-- owner -> all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON true
WHERE r.name = 'owner';

-- manager -> broad ops
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON (p.resource, p.action) IN (
    ('products', 'read'),
    ('products', 'update'),
    ('categories', 'read'),
    ('orders', 'read'),
    ('orders', 'update'),
    ('inventory', 'read'),
    ('inventory', 'update'),
    ('analytics', 'read'),
    ('staff', 'read')
  )
WHERE r.name = 'manager';

-- support
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON (p.resource, p.action) IN (
    ('orders', 'read'),
    ('support', 'ticket-read'),
    ('support', 'ticket-update'),
    ('products', 'read')
  )
WHERE r.name = 'support';

-- warehouse
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON (p.resource, p.action) IN (
    ('inventory', 'read'),
    ('inventory', 'update'),
    ('orders', 'read'),
    ('orders', 'update')
  )
WHERE r.name = 'warehouse';

-- finance
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON (p.resource, p.action) IN (
    ('billing', 'read'),
    ('billing', 'update'),
    ('orders', 'read'),
    ('orders', 'refund')
  )
WHERE r.name = 'finance';

-- Add vendor owners to vendor_staff as owner role
INSERT INTO vendor_staff (vendor_id, user_id, role_id, status, invited_by, created_at)
SELECT
  v.id,
  v.user_id,
  r.id,
  'active',
  (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
  now() - interval '90 days'
FROM vendors v
JOIN roles r ON r.vendor_id = v.id AND r.name = 'owner';

-- Add 4 staff per vendor from support users
WITH support_users AS (
  SELECT id, row_number() OVER (ORDER BY id) rn
  FROM users
  WHERE email LIKE 'vendor-staff-%@dealport.local'
),
vendors_ranked AS (
  SELECT id, row_number() OVER (ORDER BY id) rn
  FROM vendors
),
staff_slots AS (
  SELECT
    v.id AS vendor_id,
    s.slot,
    ((v.rn - 1) * 4 + s.slot) AS staff_index
  FROM vendors_ranked v
  CROSS JOIN generate_series(1, 4) s(slot)
)
INSERT INTO vendor_staff (vendor_id, user_id, role_id, status, invited_by, created_at)
SELECT
  ss.vendor_id,
  su.id,
  r.id,
  'active',
  (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
  now() - ((ss.slot * 5) || ' day')::interval
FROM staff_slots ss
JOIN support_users su ON su.rn = ss.staff_index
JOIN roles r
  ON r.vendor_id = ss.vendor_id
 AND r.name = CASE (ss.slot % 4)
   WHEN 1 THEN 'manager'
   WHEN 2 THEN 'support'
   WHEN 3 THEN 'warehouse'
   ELSE 'finance'
 END;

-- =====================================================
-- Audit logs
-- =====================================================
INSERT INTO audit_logs (vendor_id, user_id, action, resource, metadata, created_at)
SELECT
  p.vendor_id,
  u.id,
  CASE (u.id % 5)
    WHEN 0 THEN 'create'
    WHEN 1 THEN 'update'
    WHEN 2 THEN 'read'
    WHEN 3 THEN 'delete'
    ELSE 'export'
  END,
  CASE (u.id % 4)
    WHEN 0 THEN 'product'
    WHEN 1 THEN 'order'
    WHEN 2 THEN 'inventory'
    ELSE 'staff'
  END,
  jsonb_build_object(
    'source', 'seed',
    'user_email', u.email,
    'note', 'Generated seed audit event'
  ),
  now() - ((u.id % 75) || ' hour')::interval
FROM users u
JOIN products p ON p.id = ((u.id % 160) + 1)
LIMIT 450;

-- =====================================================
-- Multi-currency configs + rates + locked order rates
-- =====================================================
INSERT INTO system_config (key, value, description, updated_by)
VALUES
  ('base_currency', 'USD', 'Base currency for all monetary calculations', (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)),
  ('catalog_default_sort', 'newest', 'Default sort order for catalog pages', (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)),
  ('checkout_guest_enabled', 'true', 'Whether guest checkout is enabled', (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)),
  ('tax_rate_default', '0.08', 'Default sales tax rate used in checkout', (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1));

WITH pairs AS (
  SELECT * FROM (VALUES
    ('USD', 'EUR', 0.92000000::numeric(18,8)),
    ('EUR', 'USD', 1.08695652::numeric(18,8)),
    ('USD', 'GBP', 0.79000000::numeric(18,8)),
    ('GBP', 'USD', 1.26582278::numeric(18,8)),
    ('USD', 'CAD', 1.34000000::numeric(18,8)),
    ('CAD', 'USD', 0.74626866::numeric(18,8))
  ) AS t(from_currency, to_currency, base_rate)
),
days AS (
  SELECT gs::int AS day_offset
  FROM generate_series(0, 45) gs
)
INSERT INTO exchange_rates
  (from_currency, to_currency, rate, provider, effective_date, expires_at, is_cached, created_at)
SELECT
  p.from_currency,
  p.to_currency,
  (p.base_rate + ((d.day_offset % 5) * 0.00070000)::numeric(18,8))::numeric(18,8),
  'mock-seed-provider',
  (current_date - d.day_offset),
  (current_date - d.day_offset) + interval '2 day',
  false,
  now() - (d.day_offset || ' day')::interval
FROM pairs p
CROSS JOIN days d;

INSERT INTO order_exchange_rates
  (order_id, from_currency, to_currency, rate, original_amount, locked_at, created_at)
SELECT
  o.id,
  o.currency,
  'USD',
  CASE o.currency
    WHEN 'EUR' THEN 1.08695652
    WHEN 'GBP' THEN 1.26582278
    ELSE 0.74626866
  END::numeric(18,8),
  o.total_cents,
  o.created_at + interval '2 minute',
  o.created_at + interval '2 minute'
FROM orders o
WHERE o.status IN ('paid', 'shipped', 'delivered', 'refunded')
  AND o.currency <> 'USD'
LIMIT 180;

COMMIT;

-- =====================================================
-- Post-seed quick sanity output
-- =====================================================
SELECT 'users' AS table_name, COUNT(*) AS count FROM users
UNION ALL SELECT 'vendors', COUNT(*) FROM vendors
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'carts', COUNT(*) FROM carts
UNION ALL SELECT 'cart_items', COUNT(*) FROM cart_items
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'permissions', COUNT(*) FROM permissions
UNION ALL SELECT 'vendor_staff', COUNT(*) FROM vendor_staff
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'system_config', COUNT(*) FROM system_config
UNION ALL SELECT 'exchange_rates', COUNT(*) FROM exchange_rates
UNION ALL SELECT 'order_exchange_rates', COUNT(*) FROM order_exchange_rates;
