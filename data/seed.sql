-- ====================
-- Seed Data for E-Commerce Platform
-- ====================
-- This seed file matches 025_consolidated_schema_baseline.sql (latest migration)
-- Multi-tenant DDD architecture with complete RBAC and security

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;

-- ====================
-- 1. Clear existing data (fresh install)
-- ====================
TRUNCATE TABLE 
    audit_logs,
    security_audit_log,
    password_history,
    login_attempts,
    revoked_tokens,
    employee_permission_overrides,
    employee_invitations,
    employees,
    vendor_staff,
    role_permissions,
    roles,
    permissions,
    reviews,
    wishlists,
    inventory,
    saved_cards,
    payments,
    order_addresses,
    order_items,
    orders,
    cart_items,
    carts,
    addresses,
    product_variants,
    variants,
    products,
    categories,
    vendors,
    tenant_invitations,
    tenant_users,
    users,
    tenants
RESTART IDENTITY CASCADE;

-- ====================
-- 2. Tenants (Shared Domain - Multi-tenancy)
-- ====================
INSERT INTO tenants (name, slug, plan, status, subscription_status, max_users, max_products, max_storage_mb, settings, features) VALUES
    ('Default Tenant', 'default', 'enterprise', 'active', 'active', 1000, 10000, 50000, '{"timezone": "UTC", "currency": "USD"}', '{"multi_vendor": true, "guest_checkout": true, "analytics": true}'),
    ('Fashion Marketplace', 'fashion-marketplace', 'pro', 'active', 'active', 500, 5000, 20000, '{"timezone": "America/New_York", "currency": "USD"}', '{"multi_vendor": true, "guest_checkout": true}'),
    ('Tech Store', 'tech-store', 'starter', 'active', 'active', 100, 1000, 5000, '{"timezone": "UTC", "currency": "USD"}', '{"multi_vendor": false, "guest_checkout": true}');

-- ====================
-- 3. Users (Identity Domain)
-- ====================
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, is_verified, is_active) VALUES
    ('admin@example.com', '$argon2id$v=19$m=65536,t=3,p=4$s0X7F4nKvaKGdqATQrcxuw$vT7EkeCi6owWfJNV0EMufiAevAv5jUiOG64IK39GtAg', 'Admin', 'User', 'admin', true, true, true),
    ('vendor1@example.com', '$argon2id$v=19$m=65536,t=3,p=4$nIad+af0ZV66NXmAKQkIGA$qrhFH9wybTvZpYPTm+DbqvJh/YeMYiWO8QbFkEtTQzM', 'John', 'Fashion', 'vendor', true, true, true),
    ('vendor2@example.com', '$argon2id$v=19$m=65536,t=3,p=4$nIad+af0ZV66NXmAKQkIGA$qrhFH9wybTvZpYPTm+DbqvJh/YeMYiWO8QbFkEtTQzM', 'Sarah', 'Tech', 'vendor', true, true, true),
    ('customer1@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'John', 'Doe', 'customer', true, true, true),
    ('customer2@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'Jane', 'Smith', 'customer', true, true, true),
    ('customer3@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'Bob', 'Johnson', 'customer', true, true, true),
    ('support@example.com', '$argon2id$v=19$m=65536,t=3,p=4$ldTAhfjf8cT9Tzq5hc8k5A$USFSVFUM5kW27VvzmuZ4I+JoUhW3nNzNxWWlqgtzllw', 'Support', 'Team', 'support', true, true, true);

-- ====================
-- 4. Tenant Users (Shared Domain - Multi-tenancy)
-- ====================
INSERT INTO tenant_users (tenant_id, user_id, role, is_active, invited_by, joined_at) VALUES
    -- Default Tenant
    (1, 1, 'admin', true, NULL, NOW()),
    (1, 2, 'vendor', true, 1, NOW()),
    (1, 3, 'vendor', true, 1, NOW()),
    (1, 4, 'member', true, 1, NOW()),
    (1, 5, 'member', true, 1, NOW()),
    (1, 6, 'member', true, 1, NOW()),
    (1, 7, 'support', true, 1, NOW()),
    -- Fashion Marketplace
    (2, 1, 'admin', true, NULL, NOW()),
    (2, 2, 'vendor_manager', true, 1, NOW()),
    (2, 4, 'member', true, 1, NOW()),
    -- Tech Store
    (3, 1, 'admin', true, NULL, NOW()),
    (3, 3, 'vendor_manager', true, 1, NOW());

-- ====================
-- 5. Vendors (Vendor Domain)
-- ====================
INSERT INTO vendors (user_id, tenant_id, store_name, slug, description, status) VALUES
    (2, 1, 'Fashion Hub', 'fashion-hub', 'Premium fashion and accessories', 'active'),
    (3, 1, 'Tech Store', 'tech-store', 'Latest electronics and gadgets', 'active'),
    (2, 2, 'Fashion Marketplace Vendor', 'fashion-marketplace-vendor', 'Primary fashion vendor', 'active');

-- ====================
-- 6. Categories (Catalog Domain)
-- ====================
INSERT INTO categories (tenant_id, name, slug, path) VALUES
    (1, 'Electronics', 'electronics', 'electronics'),
    (1, 'Laptops', 'laptops', 'electronics.laptops'),
    (1, 'Phones', 'phones', 'electronics.phones'),
    (1, 'Fashion', 'fashion', 'fashion'),
    (1, 'Mens', 'mens', 'fashion.mens'),
    (1, 'Womens', 'womens', 'fashion.womens'),
    (1, 'Accessories', 'accessories', 'fashion.accessories'),
    (2, 'Fashion', 'fashion-2', 'fashion'),
    (2, 'Clothing', 'clothing', 'fashion.clothing'),
    (3, 'Electronics', 'electronics-3', 'electronics'),
    (3, 'Computers', 'computers', 'electronics.computers');

-- ====================
-- 7. Products (Catalog Domain)
-- ====================
INSERT INTO products (vendor_id, tenant_id, category_id, name, slug, description, base_price, is_active, created_by) VALUES
    (1, 1, 6, 'Summer Dress', 'summer-dress', 'Lightweight cotton summer dress', 79.99, true, 2),
    (1, 1, 5, 'Leather Jacket', 'leather-jacket', 'Genuine leather jacket for men', 299.99, true, 2),
    (1, 1, 7, 'Designer Handbag', 'designer-handbag', 'Premium leather handbag', 449.99, true, 2),
    (2, 1, 2, 'Gaming Laptop', 'gaming-laptop', 'High-performance gaming laptop', 1299.99, true, 3),
    (2, 1, 3, 'Smartphone Pro', 'smartphone-pro', 'Latest flagship smartphone', 899.99, true, 3),
    (3, 2, 8, 'Casual Dress', 'casual-dress', 'Comfortable casual dress for women', 59.99, true, 2),
    (3, 3, 12, 'Workstation PC', 'workstation-pc', 'Professional workstation computer', 1999.99, true, 3);

-- ====================
-- 8. Product Variants (Catalog Domain)
-- ====================
INSERT INTO product_variants (product_id, sku, price_cents, stock, attributes) VALUES
    -- Summer Dress variants
    (1, 'DRESS-S-BLUE', 7999, 15, '{"size": "S", "color": "Blue"}'),
    (1, 'DRESS-M-BLUE', 7999, 20, '{"size": "M", "color": "Blue"}'),
    (1, 'DRESS-L-BLUE', 7999, 10, '{"size": "L", "color": "Blue"}'),
    (1, 'DRESS-S-RED', 7999, 8, '{"size": "S", "color": "Red"}'),
    -- Leather Jacket
    (2, 'JACKET-M-BLACK', 29999, 5, '{"size": "M", "color": "Black"}'),
    (2, 'JACKET-L-BLACK', 29999, 7, '{"size": "L", "color": "Black"}'),
    (2, 'JACKET-XL-BLACK', 29999, 3, '{"size": "XL", "color": "Black"}'),
    -- Handbag
    (3, 'BAG-OS-BROWN', 44999, 12, '{"size": "One Size", "color": "Brown"}'),
    (3, 'BAG-OS-BLACK', 44999, 15, '{"size": "One Size", "color": "Black"}'),
    -- Gaming Laptop
    (4, 'LAPTOP-16GB-512GB', 129999, 8, '{"ram": "16GB", "storage": "512GB SSD"}'),
    (4, 'LAPTOP-32GB-1TB', 179999, 5, '{"ram": "32GB", "storage": "1TB SSD"}'),
    -- Smartphone
    (5, 'PHONE-128GB-BLACK', 89999, 25, '{"storage": "128GB", "color": "Black"}'),
    (5, 'PHONE-256GB-BLACK', 99999, 18, '{"storage": "256GB", "color": "Black"}'),
    (5, 'PHONE-128GB-WHITE', 89999, 20, '{"storage": "128GB", "color": "White"}'),
    -- Casual Dress
    (6, 'CASUAL-XS-PINK', 5999, 12, '{"size": "XS", "color": "Pink"}'),
    (6, 'CASUAL-S-PINK', 5999, 18, '{"size": "S", "color": "Pink"}'),
    -- Workstation PC
    (7, 'WORKSTATION-64GB-2TB', 199999, 4, '{"ram": "64GB", "storage": "2TB SSD"}');

-- ====================
-- 9. Addresses (Ordering Domain)
-- ====================
INSERT INTO addresses (user_id, tenant_id, first_name, last_name, phone, street, city, state, postal_code, country, is_primary) VALUES
    (4, 1, 'John', 'Doe', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA', true),
    (4, 1, 'John', 'Doe', '555-0101', '456 Oak Ave', 'Brooklyn', 'NY', '11201', 'USA', false),
    (5, 1, 'Jane', 'Smith', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA', true),
    (6, 1, 'Bob', 'Johnson', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA', true);

-- ====================
-- 10. Carts (Ordering Domain)
-- ====================
INSERT INTO carts (user_id, tenant_id, status) VALUES
    (4, 1, 'active'),
    (5, 1, 'active'),
    (6, 1, 'active');

-- ====================
-- 11. Cart Items (Ordering Domain)
-- ====================
INSERT INTO cart_items (cart_id, tenant_id, product_variant_id, quantity, unit_price_cents) VALUES
    (1, 1, 1, 2, 7999),
    (1, 1, 8, 1, 44999),
    (2, 1, 12, 1, 89999),
    (3, 1, 10, 1, 129999);

-- ====================
-- 12. Orders (Ordering Domain)
-- ====================
INSERT INTO orders (user_id, tenant_id, order_number, status, payment_status, fulfillment_status, currency, subtotal_cents, tax_cents, shipping_cents, total_cents) VALUES
    (4, 1, 'ORD-20260719-0001', 'delivered', 'succeeded', 'fulfilled', 'USD', 52997, 3000, 7000, 62997),
    (5, 1, 'ORD-20260719-0002', 'shipped', 'succeeded', 'partial', 'USD', 89999, 0, 0, 89999),
    (6, 1, 'ORD-20260719-0003', 'pending', 'pending', 'unfulfilled', 'USD', 129999, 0, 0, 129999),
    (4, 2, 'ORD-20260719-0004', 'paid', 'succeeded', 'unfulfilled', 'USD', 5999, 400, 0, 6399),
    (6, 3, 'ORD-20260719-0005', 'processing', 'pending', 'unfulfilled', 'USD', 199999, 15000, 5000, 219999);

-- ====================
-- 13. Order Items (Ordering Domain)
-- ====================
INSERT INTO order_items (order_id, product_id, product_variant_id, quantity, unit_price_cents, subtotal_cents) VALUES
    (1, 1, 1, 2, 7999, 15998),
    (1, 3, 8, 1, 44999, 44999),
    (2, 5, 12, 1, 89999, 89999),
    (3, 4, 10, 1, 129999, 129999),
    (4, 6, 15, 1, 5999, 5999),
    (5, 7, 17, 1, 199999, 199999);

-- ====================
-- 14. Order Addresses (Ordering Domain)
-- ====================
INSERT INTO order_addresses (order_id, type, first_name, last_name, email, phone, street, city, state, postal_code, country) VALUES
    (1, 'shipping', 'John', 'Doe', 'customer1@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (1, 'billing', 'John', 'Doe', 'customer1@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (2, 'shipping', 'Jane', 'Smith', 'customer2@example.com', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA'),
    (2, 'billing', 'Jane', 'Smith', 'customer2@example.com', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA'),
    (3, 'shipping', 'Bob', 'Johnson', 'customer3@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA'),
    (3, 'billing', 'Bob', 'Johnson', 'customer3@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA'),
    (4, 'shipping', 'John', 'Doe', 'customer1@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (4, 'billing', 'John', 'Doe', 'customer1@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (5, 'shipping', 'Bob', 'Johnson', 'customer3@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA'),
    (5, 'billing', 'Bob', 'Johnson', 'customer3@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA');

-- ====================
-- 15. Payments (Payment Domain)
-- ====================
INSERT INTO payments (order_id, stripe_payment_id, processor, status, amount_cents, currency) VALUES
    (1, 'pi_1234567890abcdef', 'stripe', 'succeeded', 62997, 'USD'),
    (2, 'pi_0987654321fedcba', 'stripe', 'succeeded', 89999, 'USD'),
    (3, 'pi_1111222233334444', 'stripe', 'pending', 129999, 'USD'),
    (4, 'pi_2222333344445555', 'stripe', 'succeeded', 6399, 'USD'),
    (5, 'pi_3333444455556666', 'stripe', 'pending', 219999, 'USD');

-- ====================
-- 16. Reviews
-- ====================
INSERT INTO reviews (user_id, product_id, rating, title, comment) VALUES
    (4, 1, 5, 'Perfect!', 'Beautiful dress, fits perfectly!'),
    (4, 3, 4, 'Great quality', 'Great quality handbag, love it'),
    (5, 5, 5, 'Amazing!', 'Amazing phone, best purchase ever!'),
    (4, 6, 5, 'Excellent', 'Perfect casual dress for everyday wear'),
    (6, 7, 5, 'Highly recommend', 'Excellent workstation, highly recommend');

-- ====================
-- 17. Roles (RBAC)
-- ====================
INSERT INTO roles (vendor_id, code, name, is_system, is_active) VALUES
    (NULL, 'ADMIN', 'Admin', true, true),
    (NULL, 'MANAGER', 'Manager', true, true),
    (NULL, 'STAFF', 'Staff', true, true),
    (1, 'VENDOR_OWNER', 'Vendor Owner', true, true),
    (1, 'VENDOR_MANAGER', 'Vendor Manager', false, true),
    (2, 'VENDOR_OWNER', 'Vendor Owner', true, true),
    (2, 'VENDOR_MANAGER', 'Vendor Manager', false, true),
    (3, 'VENDOR_OWNER', 'Vendor Owner', true, true)
ON CONFLICT DO NOTHING;

-- ====================
-- 18. Permissions
-- ====================
INSERT INTO permissions (code, name, resource, action, is_active) VALUES
    ('PRODUCT_CREATE', 'Create Product', 'products', 'create', true),
    ('PRODUCT_READ', 'Read Product', 'products', 'read', true),
    ('PRODUCT_UPDATE', 'Update Product', 'products', 'update', true),
    ('PRODUCT_DELETE', 'Delete Product', 'products', 'delete', true),
    ('ORDER_READ', 'Read Order', 'orders', 'read', true),
    ('ORDER_UPDATE', 'Update Order', 'orders', 'update', true),
    ('ORDER_REFUND', 'Refund Order', 'orders', 'refund', true),
    ('INVENTORY_READ', 'Read Inventory', 'inventory', 'read', true),
    ('INVENTORY_UPDATE', 'Update Inventory', 'inventory', 'update', true),
    ('STAFF_INVITE', 'Invite Staff', 'staff', 'invite', true),
    ('STAFF_REMOVE', 'Remove Staff', 'staff', 'remove', true),
    ('ANALYTICS_READ', 'Read Analytics', 'analytics', 'read', true),
    ('BILLING_READ', 'Read Billing', 'billing', 'read', true),
    ('BILLING_UPDATE', 'Update Billing', 'billing', 'update', true)
ON CONFLICT DO NOTHING;

-- ====================
-- 19. Role Permissions
-- ====================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin' AND r.vendor_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource IN ('products', 'orders', 'inventory', 'staff', 'analytics', 'billing')
WHERE r.code = 'VENDOR_OWNER' AND r.vendor_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ====================
-- 20. Vendor Staff
-- ====================
INSERT INTO vendor_staff (vendor_id, user_id, role_id, status, invited_by) VALUES
    (1, 2, (SELECT id FROM roles WHERE vendor_id = 1 AND code = 'VENDOR_OWNER' LIMIT 1), 'active', 1),
    (2, 3, (SELECT id FROM roles WHERE vendor_id = 2 AND code = 'VENDOR_OWNER' LIMIT 1), 'active', 1),
    (3, 2, (SELECT id FROM roles WHERE vendor_id = 3 AND code = 'VENDOR_OWNER' LIMIT 1), 'active', 1);

-- ====================
-- 21. Audit Logs
-- ====================
INSERT INTO audit_logs (vendor_id, user_id, action, resource, metadata) VALUES
    (1, 2, 'create', 'product', '{"product_id": 1, "name": "Summer Dress"}'),
    (1, 2, 'create', 'product', '{"product_id": 2, "name": "Leather Jacket"}'),
    (2, 3, 'create', 'product', '{"product_id": 4, "name": "Gaming Laptop"}'),
    (NULL, 1, 'create', 'vendor', '{"vendor_id": 1, "store_name": "Fashion Hub"}'),
    (3, 2, 'create', 'product', '{"product_id": 6, "name": "Casual Dress"}'),
    (3, 3, 'create', 'product', '{"product_id": 7, "name": "Workstation PC"}');

-- ====================
-- 22. Bulk Test Data
-- ====================

-- Additional customers
INSERT INTO users (email, password_hash, role, email_verified, is_verified, is_active)
SELECT
    'customer' || gs || '@example.com',
    '$argon2id$v=19$m=65536,t=3,p=4$09S2uHC0Az9MmIZ5sGwycQ$ndXA1w7Y5XncEUr2hU60dHu2F+s9FacUNTphE2o9Jwc',
    'customer',
    true,
    true,
    true
FROM generate_series(8, 57) gs;

-- Associate with default tenant
INSERT INTO tenant_users (tenant_id, user_id, role, is_active, joined_at)
SELECT 1, id, 'member', true, NOW()
FROM users WHERE id > 7;

-- Additional products
INSERT INTO products (vendor_id, tenant_id, category_id, name, slug, description, base_price, is_active, created_by)
SELECT
    1,
    1,
    (ARRAY[5, 6, 7])[((gs - 1) % 3) + 1],
    'Fashion Item ' || gs,
    'fashion-item-' || gs,
    'Stylish fashion item ' || gs,
    (50 + (gs % 100))::NUMERIC(12,2),
    true,
    2
FROM generate_series(8, 37) gs;

-- Product variants for new items
INSERT INTO product_variants (product_id, sku, price_cents, stock, attributes)
SELECT
    p.id,
    'SKU-' || p.id || '-' || variant_num,
    (5000 + ((p.id * 1000) + (variant_num * 500))),
    10 + (p.id % 20),
    ('{"size": "' || (ARRAY['S', 'M', 'L', 'XL'])[((variant_num - 1) % 4) + 1] || '", "color": "' || (ARRAY['Black', 'White', 'Blue', 'Red'])[((variant_num - 1) % 4) + 1] || '"}')::jsonb
FROM products p
CROSS JOIN generate_series(1, 2) variant_num
WHERE p.id > 7 AND p.tenant_id = 1;

-- Additional orders
INSERT INTO orders (user_id, tenant_id, order_number, status, payment_status, fulfillment_status, currency, subtotal_cents, tax_cents, shipping_cents, total_cents)
SELECT
    (8 + (gs % 50)),
    1,
    'ORD-20260719-' || LPAD(gs::TEXT, 4, '0'),
    (ARRAY['pending', 'paid', 'shipped', 'delivered'])[((gs - 1) % 4) + 1]::order_status,
    (ARRAY['pending', 'succeeded'])[((gs - 1) % 2) + 1]::payment_status,
    (ARRAY['unfulfilled', 'partial', 'fulfilled'])[((gs - 1) % 3) + 1],
    'USD',
    (10000 + (gs * 1000)),
    0,
    0,
    (10000 + (gs * 1000))
FROM generate_series(6, 35) gs;

-- Order items
INSERT INTO order_items (order_id, product_id, product_variant_id, quantity, unit_price_cents, subtotal_cents)
SELECT
    o.id,
    18 + ((o.id - 6) % 30),
    18 + ((o.id - 6) % 40),
    1 + ((o.id - 6) % 3),
    (5000 + (o.id * 1000)),
    ((1 + ((o.id - 6) % 3)) * (5000 + (o.id * 1000)))
FROM orders o
WHERE o.id > 5 AND o.tenant_id = 1;

-- Payments for bulk orders
INSERT INTO payments (order_id, stripe_payment_id, processor, status, amount_cents, currency)
SELECT
    o.id,
    'pi_test_' || o.id || '_' || to_char(NOW(), 'YYYYMMDD'),
    'stripe',
    o.payment_status::payment_status,
    o.total_cents,
    'USD'
FROM orders o
WHERE o.id > 5 AND o.tenant_id = 1;

-- Additional reviews
INSERT INTO reviews (user_id, product_id, rating, title, comment)
SELECT
    (8 + (gs % 50)),
    (1 + (gs % 7)),
    (3 + (gs % 3)),
    'Review ' || gs,
    'Review comment for product from user ' || gs
FROM generate_series(6, 35) gs;
