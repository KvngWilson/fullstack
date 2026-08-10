-- ====================
-- TEST QUERIES FOR SCHEMA VALIDATION
-- ====================
-- Comprehensive queries for the e-commerce platform
-- Supports current schema (queries.sql) and future migrations (009-011)
--
-- MIGRATION STATUS:
--   - Queries 1-28:   Current schema (always available)
--   - Queries 29-35:  Migration 009+ (shipment fields in orders)
--   - Queries 36-39:  Migration 010+ (webhook_events table)
--   - Queries 40-44:  Migration 011+ (vendor applications, auth enhancements)

-- ==================== DATABASE HEALTH & PERFORMANCE ====================

-- 1. TABLE SIZE ANALYSIS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 2. TRANSACTION & CONNECTION ANALYSIS
SELECT 
    pid,
    usename,
    application_name,
    state,
    query_start,
    state_change,
    wait_event_type,
    wait_event,
    EXTRACT(EPOCH FROM (NOW() - query_start)) as query_duration_sec,
    LEFT(query, 100) as query
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
ORDER BY query_start;

-- ==================== USER & BEHAVIORAL ANALYTICS ====================

-- 3. USER INFORMATION & STATISTICS
SELECT 
    u.id,
    u.email,
    u.role,
    u.email_verified,
    u.is_active,
    COUNT(DISTINCT a.id) as address_count,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.total_cents), 0) / 100.0 as lifetime_value,
    u.last_login,
    u.created_at,
    CASE WHEN u.deleted_at IS NULL THEN 'ACTIVE' ELSE 'DELETED' END as status
FROM users u
LEFT JOIN addresses a ON u.id = a.user_id AND a.deleted_at IS NULL
LEFT JOIN orders o ON u.id = o.user_id AND o.deleted_at IS NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email, u.role, u.email_verified, u.is_active, u.last_login, u.created_at, u.deleted_at
ORDER BY u.created_at DESC;

-- 4. VENDOR INFORMATION
SELECT 
    v.id,
    v.store_name,
    v.slug,
    v.description,
    v.status,
    u.email as owner_email,
    COUNT(DISTINCT p.id) as product_count,
    COUNT(DISTINCT pv.id) as variant_count,
    COUNT(DISTINCT vs.id) as staff_count,
    v.created_at
FROM vendors v
LEFT JOIN users u ON v.user_id = u.id
LEFT JOIN products p ON v.id = p.vendor_id AND p.deleted_at IS NULL
LEFT JOIN product_variants pv ON p.id = pv.product_id AND pv.deleted_at IS NULL
LEFT JOIN vendor_staff vs ON v.id = vs.vendor_id
WHERE v.deleted_at IS NULL
GROUP BY v.id, v.store_name, v.slug, v.description, v.status, u.email, v.created_at
ORDER BY v.created_at DESC;

-- 5. PRODUCT CATALOG
SELECT 
    p.id,
    p.name,
    p.slug,
    p.description,
    v.store_name as vendor_name,
    c.name as category_name,
    c.path as category_path,
    COUNT(DISTINCT pv.id) as variant_count,
    SUM(pv.stock) as total_stock,
    MIN(pv.price_cents) / 100.0 as min_price,
    MAX(pv.price_cents) / 100.0 as max_price,
    AVG(r.rating) as avg_rating,
    COUNT(DISTINCT r.id) as review_count,
    p.created_at,
    CASE WHEN p.deleted_at IS NULL THEN 'ACTIVE' ELSE 'ARCHIVED' END as status
FROM products p
LEFT JOIN vendors v ON p.vendor_id = v.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN product_variants pv ON p.id = pv.product_id AND pv.deleted_at IS NULL
LEFT JOIN reviews r ON p.id = r.product_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.slug, p.description, v.store_name, c.name, c.path, p.created_at, p.deleted_at
ORDER BY p.created_at DESC;

-- 6. PRODUCT VARIANTS & STOCK
SELECT 
    p.name as product_name,
    pv.sku,
    pv.price_cents / 100.0 as price,
    pv.stock,
    pv.attributes,
    pv.attributes->>'size' as size,
    pv.attributes->>'color' as color,
    CASE 
        WHEN pv.stock = 0 THEN 'OUT OF STOCK'
        WHEN pv.stock <= 5 THEN 'LOW STOCK'
        ELSE 'IN STOCK'
    END as stock_status,
    COUNT(DISTINCT oi.id) as times_ordered,
    pv.created_at
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
LEFT JOIN order_items oi ON pv.id = oi.product_variant_id
WHERE pv.deleted_at IS NULL AND p.deleted_at IS NULL
GROUP BY p.name, pv.sku, pv.price_cents, pv.stock, pv.attributes, pv.created_at
ORDER BY p.name, pv.sku;

-- 7. CATEGORY HIERARCHY (using ltree)
SELECT 
    c.id,
    c.name,
    c.slug,
    c.path,
    nlevel(c.path) as level,
    COUNT(DISTINCT p.id) as product_count
FROM categories c
LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.slug, c.path
ORDER BY c.path;

-- 8. ORDER SUMMARY
SELECT 
    o.id as order_id,
    u.email,
    o.created_at,
    o.status,
    o.total_cents / 100.0 as total,
    COUNT(DISTINCT oi.id) as item_count,
    SUM(oi.quantity) as total_items,
    p.status as payment_status,
    p.stripe_payment_id
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN payments p ON o.id = p.order_id
WHERE o.deleted_at IS NULL
GROUP BY o.id, u.email, o.created_at, o.status, o.total_cents, p.status, p.stripe_payment_id
ORDER BY o.created_at DESC;

-- 9. ORDER ITEMS DETAIL
SELECT 
    o.id as order_id,
    o.created_at,
    p.name as product_name,
    pv.sku,
    pv.attributes->>'size' as size,
    pv.attributes->>'color' as color,
    oi.quantity,
    oi.unit_price_cents / 100.0 as price_at_time,
    (oi.quantity * oi.unit_price_cents) / 100.0 as item_total
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN product_variants pv ON oi.product_variant_id = pv.id
JOIN products p ON pv.product_id = p.id
WHERE o.deleted_at IS NULL
ORDER BY o.id, oi.id;

-- 10. ORDER ADDRESSES (shipping and billing)
SELECT 
    o.id as order_id,
    oa.type,
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
JOIN orders o ON oa.order_id = o.id
WHERE o.deleted_at IS NULL
ORDER BY o.id, oa.type;

-- 11. PAYMENT TRACKING
SELECT 
    p.id as payment_id,
    o.id as order_id,
    u.email,
    p.stripe_payment_id,
    p.status,
    p.amount_cents / 100.0 as amount,
    o.total_cents / 100.0 as order_total,
    (o.total_cents - p.amount_cents) / 100.0 as difference,
    p.created_at,
    CASE 
        WHEN p.status = 'succeeded' THEN 'PAID'
        WHEN p.status = 'pending' THEN 'AWAITING PAYMENT'
        WHEN p.status = 'failed' THEN 'PAYMENT FAILED'
        WHEN p.status = 'refunded' THEN 'REFUNDED'
    END as payment_state
FROM payments p
JOIN orders o ON p.order_id = o.id
JOIN users u ON o.user_id = u.id
ORDER BY p.created_at DESC;

-- 12. REVIEWS & RATINGS
SELECT 
    r.id,
    u.email as reviewer_email,
    p.name as product_name,
    r.rating,
    r.comment,
    r.created_at
FROM reviews r
JOIN users u ON r.user_id = u.id
JOIN products p ON r.product_id = p.id
WHERE p.deleted_at IS NULL
ORDER BY r.created_at DESC;

-- 13. SHOPPING CARTS
SELECT 
    c.id as cart_id,
    u.email,
    COUNT(ci.id) as item_count,
    SUM(ci.quantity) as total_quantity,
    SUM(ci.quantity * pv.price_cents) / 100.0 as estimated_total,
    c.created_at
FROM carts c
JOIN users u ON c.user_id = u.id
LEFT JOIN cart_items ci ON c.id = ci.cart_id
LEFT JOIN product_variants pv ON ci.product_variant_id = pv.id
GROUP BY c.id, u.email, c.created_at
ORDER BY c.created_at DESC;

-- 14. CART ITEMS DETAIL
SELECT 
    c.id as cart_id,
    u.email,
    p.name as product_name,
    pv.sku,
    pv.price_cents / 100.0 as price,
    ci.quantity,
    (ci.quantity * pv.price_cents) / 100.0 as subtotal,
    pv.stock
FROM cart_items ci
JOIN carts c ON ci.cart_id = c.id
JOIN users u ON c.user_id = u.id
JOIN product_variants pv ON ci.product_variant_id = pv.id
JOIN products p ON pv.product_id = p.id
ORDER BY c.id, p.name;

-- 15. ADDRESSES
SELECT 
    u.email,
    a.first_name,
    a.last_name,
    a.phone,
    a.street,
    a.city,
    a.state,
    a.postal_code,
    a.country,
    a.created_at
FROM addresses a
JOIN users u ON a.user_id = u.id
WHERE a.deleted_at IS NULL
ORDER BY u.email, a.created_at;

-- ==================== SALES ANALYTICS ====================

-- 16. SALES BY DATE
SELECT 
    DATE(o.created_at) as order_date,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(DISTINCT o.user_id) as customer_count,
    SUM(oi.quantity) as items_sold,
    SUM(o.total_cents) / 100.0 as total_revenue,
    AVG(o.total_cents) / 100.0 as avg_order_value
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.deleted_at IS NULL
GROUP BY DATE(o.created_at)
ORDER BY order_date DESC;

-- 17. SALES BY VENDOR
SELECT 
    v.store_name,
    v.slug,
    COUNT(DISTINCT o.id) as order_count,
    SUM(oi.quantity) as items_sold,
    SUM(oi.quantity * oi.unit_price_cents) / 100.0 as total_revenue,
    AVG(oi.unit_price_cents) / 100.0 as avg_item_price
FROM vendors v
JOIN products p ON v.id = p.vendor_id
JOIN product_variants pv ON p.id = pv.product_id
JOIN order_items oi ON pv.id = oi.product_variant_id
JOIN orders o ON oi.order_id = o.id
WHERE v.deleted_at IS NULL 
  AND p.deleted_at IS NULL 
  AND o.deleted_at IS NULL
GROUP BY v.id, v.store_name, v.slug
ORDER BY total_revenue DESC;

-- 18. INVENTORY HEALTH CHECK
SELECT 
    p.name,
    v.store_name as vendor,
    pv.sku,
    pv.stock,
    pv.price_cents / 100.0 as price,
    pv.attributes,
    CASE 
        WHEN pv.stock = 0 THEN 'OUT OF STOCK - URGENT'
        WHEN pv.stock <= 5 THEN 'LOW STOCK - REORDER'
        WHEN pv.stock <= 10 THEN 'MONITOR'
        ELSE 'OK'
    END as action_needed,
    pv.created_at as variant_created
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
JOIN vendors v ON p.vendor_id = v.id
WHERE pv.deleted_at IS NULL AND p.deleted_at IS NULL
ORDER BY pv.stock ASC, p.name;

-- 19. CUSTOMER LIFETIME VALUE
SELECT 
    u.id,
    u.email,
    u.role,
    COUNT(DISTINCT o.id) as total_orders,
    SUM(oi.quantity) as items_purchased,
    SUM(o.total_cents) / 100.0 as total_spent,
    AVG(o.total_cents) / 100.0 as avg_order_value,
    MAX(o.created_at) as last_order_date,
    u.created_at as customer_since
FROM users u
LEFT JOIN orders o ON u.id = o.user_id AND o.deleted_at IS NULL
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE u.deleted_at IS NULL AND u.role = 'customer'
GROUP BY u.id, u.email, u.role, u.created_at
ORDER BY total_spent DESC NULLS LAST;

-- 20. PRODUCT PERFORMANCE
SELECT 
    p.id,
    p.name,
    v.store_name as vendor,
    c.name as category,
    COUNT(DISTINCT oi.id) as times_ordered,
    SUM(oi.quantity) as total_quantity_sold,
    SUM(oi.quantity * oi.unit_price_cents) / 100.0 as total_revenue,
    AVG(oi.unit_price_cents) / 100.0 as avg_price_sold,
    AVG(r.rating) as avg_rating,
    COUNT(DISTINCT r.id) as review_count
FROM products p
LEFT JOIN vendors v ON p.vendor_id = v.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN product_variants pv ON p.id = pv.product_id
LEFT JOIN order_items oi ON pv.id = oi.product_variant_id
LEFT JOIN reviews r ON p.id = r.product_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, v.store_name, c.name
ORDER BY total_quantity_sold DESC NULLS LAST;

-- 21. ORDER STATUS DISTRIBUTION
SELECT 
    status,
    COUNT(*) as order_count,
    SUM(total_cents) / 100.0 as total_revenue,
    AVG(total_cents) / 100.0 as avg_order_value,
    ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
FROM orders
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY order_count DESC;

-- ==================== RBAC & VENDOR MANAGEMENT ====================

-- 22. ROLES AND PERMISSIONS
SELECT 
    r.id,
    COALESCE(v.store_name, 'Global') as scope,
    r.name as role_name,
    r.is_system,
    COUNT(DISTINCT rp.permission_id) as permission_count,
    STRING_AGG(DISTINCT p.resource || ':' || p.action, ', ' ORDER BY p.resource || ':' || p.action) as permissions
FROM roles r
LEFT JOIN vendors v ON r.vendor_id = v.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY r.id, v.store_name, r.name, r.is_system
ORDER BY v.store_name NULLS FIRST, r.name;

-- 23. VENDOR STAFF
SELECT 
    v.store_name,
    u.email as staff_email,
    r.name as role_name,
    vs.status,
    inv.email as invited_by_email,
    vs.created_at as joined_date
FROM vendor_staff vs
JOIN vendors v ON vs.vendor_id = v.id
JOIN users u ON vs.user_id = u.id
JOIN roles r ON vs.role_id = r.id
LEFT JOIN users inv ON vs.invited_by = inv.id
ORDER BY v.store_name, vs.created_at;

-- 24. PERMISSIONS LIST
SELECT 
    resource,
    action,
    COUNT(DISTINCT rp.role_id) as roles_with_permission
FROM permissions p
LEFT JOIN role_permissions rp ON p.id = rp.permission_id
GROUP BY resource, action
ORDER BY resource, action;

-- 25. AUDIT LOGS
SELECT 
    COALESCE(v.store_name, 'Platform') as scope,
    u.email as user_email,
    al.action,
    al.resource,
    al.metadata,
    al.created_at
FROM audit_logs al
LEFT JOIN vendors v ON al.vendor_id = v.id
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 100;

-- ==================== DATA INTEGRITY & HEALTH ====================

-- 26. SOFT DELETE ANALYSIS
SELECT 
    'users' as table_name,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_count,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_count,
    COUNT(*) as total_count
FROM users

UNION ALL

SELECT 
    'vendors',
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL),
    COUNT(*)
FROM vendors

UNION ALL

SELECT 
    'products',
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL),
    COUNT(*)
FROM products

UNION ALL

SELECT 
    'product_variants',
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL),
    COUNT(*)
FROM product_variants

UNION ALL

SELECT 
    'orders',
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL),
    COUNT(*)
FROM orders

ORDER BY table_name;

-- 27. BULK DATA SUMMARY
SELECT 
    'users' as entity,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_records,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as created_last_7_days
FROM users

UNION ALL

SELECT 
    'vendors',
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')
FROM vendors

UNION ALL

SELECT 
    'products',
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')
FROM products

UNION ALL

SELECT 
    'product_variants',
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')
FROM product_variants

UNION ALL

SELECT 
    'orders',
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')
FROM orders

UNION ALL

SELECT 
    'order_items',
    COUNT(*),
    COUNT(*),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')
FROM order_items

UNION ALL

SELECT 
    'reviews',
    COUNT(*),
    COUNT(*),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')
FROM reviews

ORDER BY total_records DESC;

-- 28. PERFORMANCE BASELINE REPORT
SELECT 
    'Database Health' as metric_category,
    'Total Tables' as metric,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public')::text as value

UNION ALL

SELECT 
    'Database Health',
    'Total Indexes',
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public')::text

UNION ALL

SELECT 
    'Data Volume',
    'Total Users',
    COUNT(*)::text
FROM users WHERE deleted_at IS NULL

UNION ALL

SELECT 
    'Data Volume',
    'Total Vendors',
    COUNT(*)::text
FROM vendors WHERE deleted_at IS NULL

UNION ALL

SELECT 
    'Data Volume',
    'Total Products',
    COUNT(*)::text
FROM products WHERE deleted_at IS NULL

UNION ALL

SELECT 
    'Data Volume',
    'Total Orders',
    COUNT(*)::text
FROM orders WHERE deleted_at IS NULL

UNION ALL

SELECT 
    'Activity',
    'Orders This Month',
    COUNT(*)::text
FROM orders WHERE deleted_at IS NULL AND created_at > DATE_TRUNC('month', NOW())

UNION ALL

SELECT 
    'Activity',
    'Revenue This Month',
    ROUND(SUM(total_cents) / 100.0, 2)::text
FROM orders WHERE deleted_at IS NULL AND created_at > DATE_TRUNC('month', NOW())

ORDER BY metric_category, metric;
