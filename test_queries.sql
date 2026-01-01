-- ====================
-- SAMPLE TEST QUERIES 
-- ====================

-- 1. USER INFORMATION & STATISTICS
-- Get all users with their address count
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(a.id) as address_count,
    u.last_login,
    u.created_at
FROM users u
LEFT JOIN addresses a ON u.id = a.user_id
GROUP BY u.id, u.email, u.first_name, u.last_name, u.last_login, u.created_at
ORDER BY u.created_at DESC;

-- 2. PRODUCT CATALOG
-- Get all active products with variant and inventory info
SELECT 
    p.id,
    p.name,
    p.brand,
    p.base_price,
    COUNT(DISTINCT v.id) as variant_count,
    COUNT(DISTINCT pc.category_id) as category_count,
    SUM(i.stock_quantity) as total_stock
FROM products p
LEFT JOIN variants v ON p.id = v.product_id
LEFT JOIN inventory i ON v.id = i.variant_id
LEFT JOIN product_categories pc ON p.id = pc.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.brand, p.base_price
ORDER BY p.brand, p.name;

-- 3. PRODUCT VARIANTS & PRICING
-- Show all variants with pricing and stock levels
SELECT 
    p.name as product_name,
    v.sku,
    v.size,
    v.color,
    (p.base_price + v.price_adjustment) as final_price,
    i.stock_quantity,
    i.low_stock_threshold,
    CASE 
        WHEN i.stock_quantity <= i.low_stock_threshold THEN 'LOW STOCK'
        WHEN i.stock_quantity = 0 THEN 'OUT OF STOCK'
        ELSE 'IN STOCK'
    END as stock_status
FROM variants v
JOIN products p ON v.product_id = p.id
LEFT JOIN inventory i ON v.id = i.variant_id
ORDER BY p.name, v.color, v.size;

-- 4. CATEGORY HIERARCHY
-- Display all categories with parent relationships
SELECT 
    c.id,
    c.name,
    pc.name as parent_category,
    COUNT(DISTINCT pc2.product_id) as product_count
FROM categories c
LEFT JOIN categories pc ON c.parent_id = pc.id
LEFT JOIN product_categories pc2 ON c.id = pc2.category_id
GROUP BY c.id, c.name, pc.id, pc.name
ORDER BY COALESCE(pc.name, 'Root'), c.name;

-- 5. ORDER SUMMARY
-- Get comprehensive order information with customer details
SELECT 
    o.id as order_id,
    u.email,
    u.first_name,
    u.last_name,
    o.created_at,
    o.status,
    o.net_amount,
    o.tax,
    o.shipping_cost,
    o.total_amount,
    COUNT(oi.order_item_id) as item_count
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, u.id, u.email, u.first_name, u.last_name, o.created_at, o.status, o.net_amount, o.tax, o.shipping_cost, o.total_amount
ORDER BY o.created_at DESC;

-- 6. ORDER ITEMS DETAIL
-- Show what was ordered with product and pricing details
SELECT 
    o.id as order_id,
    o.created_at,
    p.name as product_name,
    v.sku,
    v.size,
    v.color,
    oi.quantity,
    oi.price_at_checkout,
    (oi.quantity * oi.price_at_checkout) as item_total
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN variants v ON oi.variant_id = v.id
JOIN products p ON v.product_id = p.id
ORDER BY o.id, oi.order_item_id;

-- 7. PAYMENT TRACKING
-- Monitor payment status and processors used
SELECT 
    p.id as payment_id,
    o.id as order_id,
    p.processor,
    p.status,
    p.amount,
    p.created_at,
    (o.total_amount - p.amount) as remaining_balance,
    CASE 
        WHEN p.status = 'success' THEN 'PAID'
        WHEN p.status = 'pending' THEN 'AWAITING PAYMENT'
        WHEN p.status = 'failed' THEN 'PAYMENT FAILED'
        WHEN p.status = 'refunded' THEN 'REFUNDED'
    END as payment_state
FROM payments p
JOIN orders o ON p.order_id = o.id
ORDER BY p.created_at DESC;

-- 8. RETURNS & REFUNDS
-- Track all returns and their current status
SELECT 
    r.id as return_id,
    o.id as order_id,
    u.email,
    p.name as product_name,
    v.sku,
    oi.quantity,
    r.reason,
    r.status,
    r.created_at,
    (oi.price_at_checkout * oi.quantity) as refund_amount
FROM returns r
JOIN order_items oi ON r.order_item_id = oi.order_item_id
JOIN orders o ON oi.order_id = o.id
JOIN users u ON o.user_id = u.id
JOIN variants v ON oi.variant_id = v.id
JOIN products p ON v.product_id = p.id
ORDER BY r.created_at DESC;

-- 9. WISHLISTS
-- Show customer wishlists with product details
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    p.name as product_name,
    p.brand,
    p.base_price,
    w.added_at,
    COUNT(*) OVER (PARTITION BY w.user_id) as wishlist_size
FROM wishlists w
JOIN users u ON w.user_id = u.id
JOIN products p ON w.product_id = p.id
ORDER BY u.email, p.name;

-- 10. PROMOTIONS STATUS
-- Check active and expired promotions
SELECT 
    id,
    code,
    discount_type,
    discount_value,
    min_order_amount,
    start_date,
    end_date,
    CASE 
        WHEN NOW() < start_date THEN 'SCHEDULED'
        WHEN NOW() BETWEEN start_date AND end_date THEN 'ACTIVE'
        WHEN NOW() > end_date THEN 'EXPIRED'
    END as promo_status,
    (end_date - NOW()) as days_remaining
FROM promotions
ORDER BY end_date DESC;

-- 11. SALES ANALYTICS
-- Revenue and order metrics
SELECT 
    DATE(o.created_at) as order_date,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(DISTINCT o.user_id) as customer_count,
    COUNT(oi.order_item_id) as items_sold,
    ROUND(SUM(o.net_amount)::numeric, 2) as gross_revenue,
    ROUND(SUM(o.tax)::numeric, 2) as total_tax,
    ROUND(SUM(o.shipping_cost)::numeric, 2) as total_shipping,
    ROUND(SUM(o.total_amount)::numeric, 2) as net_revenue,
    ROUND(AVG(o.total_amount)::numeric, 2) as avg_order_value
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY DATE(o.created_at)
ORDER BY order_date DESC;

-- 12. INVENTORY HEALTH CHECK
-- Find low stock and out of stock items
SELECT 
    p.name,
    p.brand,
    v.sku,
    v.size,
    v.color,
    i.stock_quantity,
    i.low_stock_threshold,
    CASE 
        WHEN i.stock_quantity = 0 THEN 'OUT OF STOCK - URGENT'
        WHEN i.stock_quantity <= i.low_stock_threshold THEN 'LOW STOCK - REORDER'
        ELSE 'OK'
    END as action_needed,
    i.last_restocked
FROM inventory i
JOIN variants v ON i.variant_id = v.id
JOIN products p ON v.product_id = p.id
WHERE i.stock_quantity <= i.low_stock_threshold OR i.stock_quantity = 0
ORDER BY i.stock_quantity ASC, p.name;

-- 13. CUSTOMER LIFETIME VALUE
-- Analyze customer spending patterns
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT oi.order_item_id) as items_purchased,
    ROUND(SUM(o.total_amount)::numeric, 2) as total_spent,
    ROUND(AVG(o.total_amount)::numeric, 2) as avg_order_value,
    MAX(o.created_at) as last_order_date,
    MIN(u.created_at) as customer_since
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY u.id, u.email, u.first_name, u.last_name
ORDER BY total_spent DESC NULLS LAST;

-- 14. PRODUCT PERFORMANCE
-- Top sellers and revenue generators
SELECT 
    p.id,
    p.name,
    p.brand,
    p.base_price,
    COUNT(DISTINCT oi.order_item_id) as times_ordered,
    SUM(oi.quantity) as total_quantity_sold,
    ROUND(SUM(oi.quantity * oi.price_at_checkout)::numeric, 2) as total_revenue,
    ROUND(AVG(oi.price_at_checkout)::numeric, 2) as avg_price_sold
FROM products p
LEFT JOIN variants v ON p.id = v.product_id
LEFT JOIN order_items oi ON v.id = oi.variant_id
GROUP BY p.id, p.name, p.brand, p.base_price
ORDER BY total_quantity_sold DESC NULLS LAST;

-- 15. ORDER STATUS DISTRIBUTION
-- See breakdown of orders by status
SELECT 
    status,
    COUNT(*) as order_count,
    ROUND(SUM(total_amount)::numeric, 2) as total_revenue,
    ROUND(AVG(total_amount)::numeric, 2) as avg_order_value,
    ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER())::numeric, 2) as percentage
FROM orders
GROUP BY status
ORDER BY order_count DESC;

-- 16. MEDIA GALLERY
-- Products with their media assets
SELECT 
    p.name as product_name,
    p.brand,
    COUNT(DISTINCT m.id) as media_count,
    STRING_AGG(DISTINCT m.type, ', ') as media_types,
    COUNT(DISTINCT CASE WHEN m.type = 'image' THEN m.id END) as image_count,
    COUNT(DISTINCT CASE WHEN m.type = 'video' THEN m.id END) as video_count,
    COUNT(DISTINCT CASE WHEN m.type = 'lookbook' THEN m.id END) as lookbook_count
FROM products p
LEFT JOIN media m ON p.id = m.product_id
GROUP BY p.id, p.name, p.brand
ORDER BY p.name;

-- 17. ADDRESS BOOK
-- Customer addresses organized by type
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    a.type,
    a.street,
    a.city,
    a.state,
    a.postal_code,
    a.country,
    a.is_primary,
    ROW_NUMBER() OVER (PARTITION BY u.id, a.type ORDER BY a.is_primary DESC) as address_rank
FROM users u
LEFT JOIN addresses a ON u.id = a.user_id
ORDER BY u.email, a.type, a.is_primary DESC;

-- 18. VARIANT COLOR & SIZE MATRIX
-- See available sizes and colors per product
SELECT 
    p.name,
    STRING_AGG(DISTINCT v.color, ', ' ORDER BY v.color) as available_colors,
    STRING_AGG(DISTINCT v.size, ', ' ORDER BY v.size) as available_sizes,
    COUNT(DISTINCT v.id) as variant_count
FROM products p
LEFT JOIN variants v ON p.id = v.product_id
GROUP BY p.id, p.name
ORDER BY p.name;

-- 19. PRICE ADJUSTMENT ANALYSIS
-- See how variant pricing differs from base price
SELECT 
    p.name,
    p.base_price,
    v.sku,
    v.size,
    v.color,
    v.price_adjustment,
    (p.base_price + v.price_adjustment) as adjusted_price,
    ROUND((v.price_adjustment / p.base_price * 100)::numeric, 2) as price_change_percent
FROM variants v
JOIN products p ON v.product_id = p.id
WHERE v.price_adjustment != 0
ORDER BY p.name, v.price_adjustment DESC;

-- 20. PENDING ACTIONS
-- Show items that need attention
SELECT 
    'PAYMENT PENDING' as action_type,
    o.id as reference_id,
    u.email,
    o.total_amount as amount,
    o.created_at as action_date,
    'Payment' as action_description
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.status = 'pending'

UNION ALL

SELECT 
    'RETURN REQUESTED' as action_type,
    r.id as reference_id,
    u.email,
    oi.price_at_checkout * oi.quantity as amount,
    r.created_at as action_date,
    'Return' as action_description
FROM returns r
JOIN order_items oi ON r.order_item_id = oi.order_item_id
JOIN orders o ON oi.order_id = o.id
JOIN users u ON o.user_id = u.id
WHERE r.status IN ('requested', 'approved')

UNION ALL

SELECT 
    'LOW INVENTORY' as action_type,
    i.inventory_id as reference_id,
    p.brand as email,
    i.stock_quantity::decimal as amount,
    i.last_restocked as action_date,
    'Restock' as action_description
FROM inventory i
JOIN variants v ON i.variant_id = v.id
JOIN products p ON v.product_id = p.id
WHERE i.stock_quantity <= i.low_stock_threshold

ORDER BY action_date DESC;
