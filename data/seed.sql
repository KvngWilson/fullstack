-- ====================
-- Seed Data for E-Commerce Platform
-- ====================
-- This seed file matches the current schema from queries.sql
-- Tables: users, vendors, categories, products, product_variants, addresses,
--         carts, cart_items, orders, order_items, order_addresses, payments,
--         reviews, roles, permissions, role_permissions, vendor_staff, audit_logs

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;

-- ====================
-- 1. Clear existing data (optional for fresh install)
-- ====================
TRUNCATE TABLE 
    audit_logs,
    vendor_staff,
    role_permissions,
    permissions,
    roles,
    reviews,
    payments,
    order_addresses,
    order_items,
    orders,
    cart_items,
    carts,
    addresses,
    product_variants,
    products,
    categories,
    vendors,
    users
RESTART IDENTITY CASCADE;

-- ====================
-- 2. Users
-- ====================
INSERT INTO users (email, password_hash, role, email_verified, is_active) VALUES
    ('admin@example.com', '$argon2id$v=19$m=65536,t=3,p=4$s0X7F4nKvaKGdqATQrcxuw$vT7EkeCi6owWfJNV0EMufiAevAv5jUiOG64IK39GtAg', 'admin', true, true),
    ('vendor1@example.com', '$argon2id$v=19$m=65536,t=3,p=4$nIad+af0ZV66NXmAKQkIGA$qrhFH9wybTvZpYPTm+DbqvJh/YeMYiWO8QbFkEtTQzM', 'vendor', true, true),
    ('vendor2@example.com', '$argon2id$v=19$m=65536,t=3,p=4$nIad+af0ZV66NXmAKQkIGA$qrhFH9wybTvZpYPTm+DbqvJh/YeMYiWO8QbFkEtTQzM', 'vendor', true, true),
    ('customer1@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'customer', true, true),
    ('customer2@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'customer', true, true),
    ('customer3@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'customer', true, true),
    ('support@example.com', '$argon2id$v=19$m=65536,t=3,p=4$ldTAhfjf8cT9Tzq5hc8k5A$USFSVFUM5kW27VvzmuZ4I+JoUhW3nNzNxWWlqgtzllw', 'support', true, true);

-- ====================
-- 3. Vendors
-- ====================
INSERT INTO vendors (user_id, store_name, slug, description, status) VALUES
    (2, 'Fashion Hub', 'fashion-hub', 'Premium fashion and accessories', 'active'),
    (3, 'Tech Store', 'tech-store', 'Latest electronics and gadgets', 'active');

-- ====================
-- 4. Categories (using ltree paths)
-- ====================
INSERT INTO categories (name, slug, path) VALUES
    ('Electronics', 'electronics', 'electronics'),
    ('Laptops', 'laptops', 'electronics.laptops'),
    ('Phones', 'phones', 'electronics.phones'),
    ('Fashion', 'fashion', 'fashion'),
    ('Mens', 'mens', 'fashion.mens'),
    ('Womens', 'womens', 'fashion.womens'),
    ('Accessories', 'accessories', 'fashion.accessories');

-- ====================
-- 5. Products (no base_price or is_active columns in current schema)
-- ====================
INSERT INTO products (vendor_id, category_id, name, slug, description) VALUES
    (1, 6, 'Summer Dress', 'summer-dress', 'Lightweight cotton summer dress'),
    (1, 5, 'Leather Jacket', 'leather-jacket', 'Genuine leather jacket for men'),
    (1, 7, 'Designer Handbag', 'designer-handbag', 'Premium leather handbag'),
    (2, 2, 'Gaming Laptop', 'gaming-laptop', 'High-performance gaming laptop'),
    (2, 3, 'Smartphone Pro', 'smartphone-pro', 'Latest flagship smartphone');

-- ====================
-- 6. Product Variants (with stock and attributes as JSONB)
-- ====================
INSERT INTO product_variants (product_id, sku, price, stock, attributes) VALUES
    -- Summer Dress variants
    (1, 'DRESS-S-BLUE', 79.99, 15, '{"size": "S", "color": "Blue"}'),
    (1, 'DRESS-M-BLUE', 79.99, 20, '{"size": "M", "color": "Blue"}'),
    (1, 'DRESS-L-BLUE', 79.99, 10, '{"size": "L", "color": "Blue"}'),
    (1, 'DRESS-S-RED', 79.99, 8, '{"size": "S", "color": "Red"}'),
    -- Leather Jacket variants
    (2, 'JACKET-M-BLACK', 299.99, 5, '{"size": "M", "color": "Black"}'),
    (2, 'JACKET-L-BLACK', 299.99, 7, '{"size": "L", "color": "Black"}'),
    (2, 'JACKET-XL-BLACK', 299.99, 3, '{"size": "XL", "color": "Black"}'),
    -- Designer Handbag
    (3, 'BAG-OS-BROWN', 449.99, 12, '{"size": "One Size", "color": "Brown"}'),
    (3, 'BAG-OS-BLACK', 449.99, 15, '{"size": "One Size", "color": "Black"}'),
    -- Gaming Laptop
    (4, 'LAPTOP-16GB-512GB', 1299.99, 8, '{"ram": "16GB", "storage": "512GB SSD"}'),
    (4, 'LAPTOP-32GB-1TB', 1799.99, 5, '{"ram": "32GB", "storage": "1TB SSD"}'),
    -- Smartphone
    (5, 'PHONE-128GB-BLACK', 899.99, 25, '{"storage": "128GB", "color": "Black"}'),
    (5, 'PHONE-256GB-BLACK', 999.99, 18, '{"storage": "256GB", "color": "Black"}'),
    (5, 'PHONE-128GB-WHITE', 899.99, 20, '{"storage": "128GB", "color": "White"}');

-- ====================
-- 7. Addresses
-- ====================
INSERT INTO addresses (user_id, first_name, last_name, phone, street, city, state, postal_code, country) VALUES
    (4, 'John', 'Doe', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (4, 'John', 'Doe', '555-0101', '456 Oak Ave', 'Brooklyn', 'NY', '11201', 'USA'),
    (5, 'Jane', 'Smith', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA'),
    (6, 'Bob', 'Johnson', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA');

-- ====================
-- 8. Carts
-- ====================
INSERT INTO carts (user_id) VALUES
    (4),
    (5),
    (6);

-- ====================
-- 9. Cart Items
-- ====================
INSERT INTO cart_items (cart_id, product_variant_id, quantity) VALUES
    (1, 1, 2),  -- Customer 1 has 2 summer dresses (S, Blue)
    (1, 8, 1),  -- Customer 1 has 1 handbag (Brown)
    (2, 12, 1), -- Customer 2 has 1 phone (128GB, Black)
    (3, 10, 1); -- Customer 3 has 1 laptop (16GB)

-- ====================
-- 10. Orders
-- ====================
INSERT INTO orders (user_id, status, total) VALUES
    (4, 'delivered', 609.97),
    (5, 'shipped', 899.99),
    (6, 'pending', 1299.99);

-- ====================
-- 11. Order Items
-- ====================
INSERT INTO order_items (order_id, product_variant_id, quantity, price_at_time) VALUES
    -- Order 1 (customer 4)
    (1, 1, 2, 79.99),
    (1, 8, 1, 449.99),
    -- Order 2 (customer 5)
    (2, 12, 1, 899.99),
    -- Order 3 (customer 6)
    (3, 10, 1, 1299.99);

-- ====================
-- 12. Order Addresses (snapshots at order time)
-- ====================
INSERT INTO order_addresses (order_id, type, first_name, last_name, email, phone, street, city, state, postal_code, country) VALUES
    -- Order 1 shipping
    (1, 'shipping', 'John', 'Doe', 'customer1@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (1, 'billing', 'John', 'Doe', 'customer1@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    -- Order 2 shipping
    (2, 'shipping', 'Jane', 'Smith', 'customer2@example.com', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA'),
    (2, 'billing', 'Jane', 'Smith', 'customer2@example.com', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA'),
    -- Order 3 shipping
    (3, 'shipping', 'Bob', 'Johnson', 'customer3@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA'),
    (3, 'billing', 'Bob', 'Johnson', 'customer3@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA');

-- ====================
-- 13. Payments
-- ====================
INSERT INTO payments (order_id, stripe_payment_id, status, amount) VALUES
    (1, 'pi_1234567890abcdef', 'succeeded', 609.97),
    (2, 'pi_0987654321fedcba', 'succeeded', 899.99),
    (3, 'pi_1111222233334444', 'pending', 1299.99);

-- ====================
-- 14. Reviews
-- ====================
INSERT INTO reviews (user_id, product_id, rating, comment) VALUES
    (4, 1, 5, 'Beautiful dress, fits perfectly!'),
    (4, 3, 4, 'Great quality handbag, love it'),
    (5, 5, 5, 'Amazing phone, best purchase ever!');

-- ====================
-- 15. Roles (global and vendor-local roles)
-- ====================
INSERT INTO roles (vendor_id, name, is_system) VALUES
    (NULL, 'admin', true),
    (NULL, 'manager', true),
    (NULL, 'staff', true),
    (1, 'owner', true),
    (1, 'manager', false),
    (2, 'owner', true),
    (2, 'manager', false)
ON CONFLICT DO NOTHING;

-- ====================
-- 16. Permissions (global resource/action pairs)
-- ====================
INSERT INTO permissions (resource, action) VALUES
    ('products', 'create'),
    ('products', 'read'),
    ('products', 'update'),
    ('products', 'delete'),
    ('orders', 'read'),
    ('orders', 'update'),
    ('orders', 'refund'),
    ('inventory', 'read'),
    ('inventory', 'update'),
    ('staff', 'invite'),
    ('staff', 'remove'),
    ('analytics', 'read'),
    ('billing', 'read'),
    ('billing', 'update')
ON CONFLICT DO NOTHING;

-- ====================
-- 17. Role Permissions
-- ====================
-- Admin role gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' AND r.vendor_id IS NULL
ON CONFLICT DO NOTHING;

-- Vendor owner gets product/order/inventory permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource IN ('products', 'orders', 'inventory', 'staff', 'analytics', 'billing')
WHERE r.name = 'owner' AND r.vendor_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ====================
-- 18. Vendor Staff
-- ====================
INSERT INTO vendor_staff (vendor_id, user_id, role_id, status, invited_by) VALUES
    (1, 2, (SELECT id FROM roles WHERE vendor_id = 1 AND name = 'owner' LIMIT 1), 'active', 1),
    (2, 3, (SELECT id FROM roles WHERE vendor_id = 2 AND name = 'owner' LIMIT 1), 'active', 1);

-- ====================
-- 19. Audit Logs
-- ====================
INSERT INTO audit_logs (vendor_id, user_id, action, resource, metadata) VALUES
    (1, 2, 'create', 'product', '{"product_id": 1, "name": "Summer Dress"}'),
    (1, 2, 'create', 'product', '{"product_id": 2, "name": "Leather Jacket"}'),
    (2, 3, 'create', 'product', '{"product_id": 4, "name": "Gaming Laptop"}'),
    (NULL, 1, 'create', 'vendor', '{"vendor_id": 1, "store_name": "Fashion Hub"}');

-- ====================
-- 20. Bulk Test Data (optional for load testing)
-- ====================

-- Additional customers (50 more for testing)
INSERT INTO users (email, password_hash, role, email_verified, is_active)
SELECT
    'customer' || gs || '@example.com',
    '$argon2id$v=19$m=65536,t=3,p=4$09S2uHC0Az9MmIZ5sGwycQ$ndXA1w7Y5XncEUr2hU60dHu2F+s9FacUNTphE2o9Jwc',
    'customer',
    true,
    true
FROM generate_series(8, 57) gs;

-- Additional products for vendor 1 (30 more fashion items)
INSERT INTO products (vendor_id, category_id, name, slug, description)
SELECT
    1,
    (ARRAY[5, 6, 7])[((gs - 1) % 3) + 1],
    'Fashion Item ' || gs,
    'fashion-item-' || gs,
    'Stylish fashion item ' || gs
FROM generate_series(6, 35) gs;

-- Product variants for new products (2 sizes per product)
INSERT INTO product_variants (product_id, sku, price, stock, attributes)
SELECT
    p.id,
    'SKU-' || p.id || '-' || variant_num,
    (50 + (p.id * 10 + variant_num * 5))::numeric(10,2),
    10 + (p.id % 20),
    ('{"size": "' || (ARRAY['S', 'M', 'L', 'XL'])[((variant_num - 1) % 4) + 1] || '", "color": "' || (ARRAY['Black', 'White', 'Blue', 'Red'])[((variant_num - 1) % 4) + 1] || '"}')::jsonb
FROM products p
CROSS JOIN generate_series(1, 2) variant_num
WHERE p.id > 5;

-- Additional orders (30 more)
INSERT INTO orders (user_id, status, total)
SELECT
    (4 + (gs % 50)),
    (ARRAY['pending', 'paid', 'shipped', 'delivered'])[((gs - 1) % 4) + 1]::order_status,
    (100 + (gs * 10))::numeric(12,2)
FROM generate_series(4, 33) gs;

-- Order items for new orders
INSERT INTO order_items (order_id, product_variant_id, quantity, price_at_time)
SELECT
    o.id,
    15 + ((o.id - 4) % 30),
    1 + ((o.id - 4) % 3),
    (50 + (o.id * 10))::numeric(12,2)
FROM orders o
WHERE o.id > 3;

-- Payments for new orders
INSERT INTO payments (order_id, stripe_payment_id, status, amount)
SELECT
    o.id,
    'pi_test_' || o.id || '_' || to_char(NOW(), 'YYYYMMDD'),
    CASE 
        WHEN o.status = 'pending' THEN 'pending'::payment_status
        WHEN o.status IN ('paid', 'shipped', 'delivered') THEN 'succeeded'::payment_status
        ELSE 'pending'::payment_status
    END,
    o.total
FROM orders o
WHERE o.id > 3;

-- Additional reviews
INSERT INTO reviews (user_id, product_id, rating, comment)
SELECT
    (4 + (gs % 50)),
    (1 + (gs % 5)),
    (3 + (gs % 3)),
    'Review comment for product from user ' || gs
FROM generate_series(4, 23) gs;
