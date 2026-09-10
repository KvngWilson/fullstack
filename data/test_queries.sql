-- =====================================================
-- Tenant-aware validation queries for the current schema
-- =====================================================

-- 1. Tenant overview
SELECT
  t.id,
  t.name,
  t.slug,
  t.status,
  COUNT(DISTINCT tu.user_id) AS member_count,
  COUNT(DISTINCT v.id) AS vendor_count
FROM tenants t
LEFT JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.is_active = true
LEFT JOIN vendors v ON v.tenant_id = t.id AND v.deleted_at IS NULL
GROUP BY t.id, t.name, t.slug, t.status
ORDER BY t.name;

-- 2. User + tenant membership
SELECT
  u.id,
  u.email,
  u.role,
  tu.role AS tenant_role,
  t.name AS tenant_name,
  t.slug AS tenant_slug
FROM users u
LEFT JOIN tenant_users tu ON tu.user_id = u.id AND tu.is_active = true
LEFT JOIN tenants t ON t.id = tu.tenant_id
WHERE u.is_active = true
ORDER BY u.created_at DESC;

-- 3. Vendor roster
SELECT
  v.id,
  v.store_name,
  t.name AS tenant_name,
  u.email AS owner_email,
  COUNT(DISTINCT p.id) AS product_count,
  COUNT(DISTINCT pv.id) AS variant_count
FROM vendors v
JOIN tenants t ON t.id = v.tenant_id
JOIN users u ON u.id = v.user_id
LEFT JOIN products p ON p.vendor_id = v.id AND p.deleted_at IS NULL
LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
GROUP BY v.id, v.store_name, t.name, u.email
ORDER BY v.store_name;

-- 4. Product catalog summary
SELECT
  p.id,
  p.name,
  v.store_name AS vendor_name,
  t.name AS tenant_name,
  c.name AS category_name,
  COUNT(DISTINCT pv.id) AS variant_count,
  COALESCE(SUM(pv.stock), 0) AS total_stock,
  MIN(pv.price_cents) / 100.0 AS min_price,
  MAX(pv.price_cents) / 100.0 AS max_price
FROM products p
JOIN vendors v ON v.id = p.vendor_id
JOIN tenants t ON t.id = v.tenant_id
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, v.store_name, t.name, c.name
ORDER BY p.created_at DESC;

-- 5. Variant availability
SELECT
  p.name AS product_name,
  pv.sku,
  pv.price_cents / 100.0 AS price,
  pv.stock,
  pv.attributes,
  CASE
    WHEN pv.stock = 0 THEN 'OUT OF STOCK'
    WHEN pv.stock <= 5 THEN 'LOW STOCK'
    ELSE 'IN STOCK'
  END AS stock_status
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.deleted_at IS NULL
ORDER BY p.name, pv.sku;

-- 6. Shopping cart summary
SELECT
  c.id AS cart_id,
  u.email,
  t.name AS tenant_name,
  COUNT(ci.id) AS item_count,
  SUM(ci.quantity) AS total_quantity
FROM carts c
JOIN users u ON u.id = c.user_id
JOIN tenants t ON t.id = c.tenant_id
LEFT JOIN cart_items ci ON ci.cart_id = c.id
GROUP BY c.id, u.email, t.name
ORDER BY c.id;

-- 7. Order overview
SELECT
  o.id AS order_id,
  o.order_number,
  u.email,
  t.name AS tenant_name,
  o.status,
  o.payment_status,
  o.fulfillment_status,
  o.total_cents / 100.0 AS total
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN tenants t ON t.id = o.tenant_id
ORDER BY o.created_at DESC;

-- 8. Order items detail
SELECT
  o.order_number,
  p.name AS product_name,
  pv.sku,
  oi.quantity,
  oi.unit_price_cents / 100.0 AS unit_price,
  oi.subtotal_cents / 100.0 AS subtotal
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
ORDER BY o.created_at DESC, oi.id;

-- 9. Payment status by tenant
SELECT
  t.name AS tenant_name,
  o.order_number,
  p.status AS payment_status,
  p.amount_cents / 100.0 AS amount,
  p.created_at
FROM payments p
JOIN orders o ON o.id = p.order_id
JOIN tenants t ON t.id = o.tenant_id
ORDER BY t.name, p.created_at DESC;

-- 10. RBAC matrix
SELECT
  v.store_name,
  r.name AS role_name,
  p.resource,
  p.action
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN vendors v ON v.id = r.vendor_id
JOIN permissions p ON p.id = rp.permission_id
ORDER BY v.store_name, r.name, p.resource, p.action;

-- 11. Audit activity
SELECT
  a.id,
  v.store_name,
  u.email AS actor_email,
  a.action,
  a.resource,
  a.created_at
FROM audit_logs a
LEFT JOIN vendors v ON v.id = a.vendor_id
LEFT JOIN users u ON u.id = a.user_id
ORDER BY a.created_at DESC;

-- 12. Tenant review scorecard
SELECT
  t.name AS tenant_name,
  COUNT(DISTINCT r.id) AS review_count,
  ROUND(AVG(r.rating), 2) AS avg_rating
FROM tenants t
LEFT JOIN products p ON p.tenant_id = t.id
LEFT JOIN reviews r ON r.product_id = p.id
GROUP BY t.name
ORDER BY t.name;
