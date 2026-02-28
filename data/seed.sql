-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;

-- Clear existing data (optional for fresh install)
TRUNCATE TABLE 
    security_audit_log,
    login_attempts,
    revoked_tokens,
    employee_permission_overrides,
    employee_invitations,
    employees,
    password_history,
    audit_logs,
    vendor_staff,
    role_permissions,
    permissions,
    roles,
    wishlists,
    saved_cards,
    inventory,
    reviews,
    payments,
    order_addresses,
    order_items,
    orders,
    cart_items,
    carts,
    addresses,
    variants,
    product_variants,
    products,
    categories,
    vendors,
    users
RESTART IDENTITY CASCADE;

-- ====================
-- 1. Users
-- ====================
INSERT INTO users (email, password_hash, role) VALUES
    ('admin@example.com', '$argon2id$v=19$m=65536,t=3,p=4$s0X7F4nKvaKGdqATQrcxuw$vT7EkeCi6owWfJNV0EMufiAevAv5jUiOG64IK39GtAg', 'admin'),
    ('vendor1@example.com', '$argon2id$v=19$m=65536,t=3,p=4$nIad+af0ZV66NXmAKQkIGA$qrhFH9wybTvZpYPTm+DbqvJh/YeMYiWO8QbFkEtTQzM', 'vendor'),
    ('vendor2@example.com', '$argon2id$v=19$m=65536,t=3,p=4$nIad+af0ZV66NXmAKQkIGA$qrhFH9wybTvZpYPTm+DbqvJh/YeMYiWO8QbFkEtTQzM', 'vendor'),
    ('customer1@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'customer'),
    ('customer2@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'customer'),
    ('customer3@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'customer'),
    ('support@example.com', '$argon2id$v=19$m=65536,t=3,p=4$ldTAhfjf8cT9Tzq5hc8k5A$USFSVFUM5kW27VvzmuZ4I+JoUhW3nNzNxWWlqgtzllw', 'support');

-- ====================
-- 2. Vendors
-- ====================
INSERT INTO vendors (user_id, store_name, slug, description, status) VALUES
    (2, 'Fashion Hub', 'fashion-hub', 'Premium fashion and accessories', 'active'),
    (3, 'Tech Store', 'tech-store', 'Latest electronics and gadgets', 'active');

-- ====================
-- 3. Categories (using ltree paths)
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
-- 4. Products
-- ====================
INSERT INTO products (vendor_id, category_id, name, slug, description, base_price, is_active) VALUES
    (1, 6, 'Summer Dress', 'summer-dress', 'Lightweight cotton summer dress', 79.99, true),
    (1, 5, 'Leather Jacket', 'leather-jacket', 'Genuine leather jacket for men', 299.99, true),
    (1, 7, 'Designer Handbag', 'designer-handbag', 'Premium leather handbag', 449.99, true),
    (2, 2, 'Gaming Laptop', 'gaming-laptop', 'High-performance gaming laptop', 1299.99, true),
    (2, 3, 'Smartphone Pro', 'smartphone-pro', 'Latest flagship smartphone', 899.99, true);

-- ====================
-- 5. Product Variants (with stock and attributes as JSONB)
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
-- 6. Addresses
-- ====================
INSERT INTO addresses (user_id, first_name, last_name, phone, street, city, state, postal_code, country) VALUES
    (4, 'John', 'Doe', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (4, 'John', 'Doe', '555-0101', '456 Oak Ave', 'Brooklyn', 'NY', '11201', 'USA'),
    (5, 'Jane', 'Smith', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA'),
    (6, 'Bob', 'Johnson', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA');

-- ====================
-- 7. Carts
-- ====================
INSERT INTO carts (user_id) VALUES
    (4),
    (5),
    (6);

-- ====================
-- 8. Cart Items
-- ====================
INSERT INTO cart_items (cart_id, product_variant_id, quantity) VALUES
    (1, 1, 2),  -- Customer 1 has 2 summer dresses (S, Blue)
    (1, 8, 1),  -- Customer 1 has 1 handbag (Brown)
    (2, 12, 1), -- Customer 2 has 1 phone (128GB, Black)
    (3, 10, 1); -- Customer 3 has 1 laptop (16GB)

-- ====================
-- 9. Orders
-- ====================
INSERT INTO orders (user_id, status, total, net_amount, tax, shipping_cost, total_amount) VALUES
    (4, 'delivered', 609.97, 589.97, 10.00, 10.00, 609.97),
    (5, 'shipped', 899.99, 879.99, 10.00, 10.00, 899.99),
    (6, 'pending', 1299.99, 1279.99, 10.00, 10.00, 1299.99);

-- ====================
-- 10. Order Items
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
-- 11. Order Addresses (snapshots at order time)
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
-- 12. Payments
-- ====================
INSERT INTO payments (order_id, stripe_payment_id, status, amount) VALUES
    (1, 'pi_1234567890abcdef', 'succeeded', 609.97),
    (2, 'pi_0987654321fedcba', 'succeeded', 899.99),
    (3, 'pi_1111222233334444', 'pending', 1299.99);

-- ====================
-- 13. Reviews
-- ====================
INSERT INTO reviews (user_id, product_id, rating, comment) VALUES
    (4, 1, 5, 'Beautiful dress, fits perfectly!'),
    (4, 3, 4, 'Great quality handbag, love it'),
    (5, 5, 5, 'Amazing phone, best purchase ever!');

-- ====================
-- 14. Roles (global employee RBAC + vendor-local roles)
-- ====================
INSERT INTO roles (vendor_id, code, name, description, hierarchy_level, is_system, is_active) VALUES
    (NULL, 'super_admin', 'SuperAdmin', 'Full system access', 100, true, true),
    (NULL, 'admin', 'Admin', 'Administrative access', 50, true, true),
    (NULL, 'manager', 'Manager', 'Team and workflow management', 30, true, true),
    (NULL, 'finance', 'Finance', 'Financial and reconciliation access', 25, true, true),
    (NULL, 'warehouse', 'Warehouse', 'Inventory and fulfillment access', 20, true, true),
    (NULL, 'support', 'Support', 'Customer support access', 15, true, true),
    (NULL, 'readonly', 'Read Only', 'View-only access', 0, true, true),
    (1, NULL, 'owner', 'Vendor owner role', 40, true, true),
    (1, NULL, 'manager', 'Vendor manager role', 30, false, true),
    (1, NULL, 'staff', 'Vendor staff role', 10, false, true),
    (2, NULL, 'owner', 'Vendor owner role', 40, true, true),
    (2, NULL, 'manager', 'Vendor manager role', 30, false, true)
ON CONFLICT DO NOTHING;

-- ====================
-- 15. Permissions (code-based + legacy resource/action compatibility)
-- ====================
INSERT INTO permissions (code, name, category, description, resource, action) VALUES
    ('dashboard:view', 'View Dashboard', 'dashboard', 'Access dashboard', 'analytics', 'read'),
    ('dashboard:export', 'Export Dashboard Reports', 'dashboard', 'Export analytics reports', 'analytics', 'export'),
    ('user:read', 'Read Users', 'users', 'View users', 'users', 'read'),
    ('user:create', 'Create Users', 'users', 'Create users', 'users', 'create'),
    ('user:update', 'Update Users', 'users', 'Update users', 'users', 'update'),
    ('user:delete', 'Delete Users', 'users', 'Delete users', 'users', 'delete'),
    ('user:role_assign', 'Assign User Roles', 'users', 'Assign user roles', 'users', 'assign_role'),
    ('user:suspend', 'Suspend Users', 'users', 'Suspend users', 'users', 'suspend'),
    ('user:force_password_reset', 'Force Password Reset', 'users', 'Force reset user password', 'users', 'force_password_reset'),
    ('employee:invite', 'Invite Employees', 'employees', 'Create invitations', 'staff', 'invite'),
    ('employee:manage', 'Manage Employees', 'employees', 'Manage employee lifecycle', 'staff', 'manage'),
    ('order:read', 'Read Orders', 'orders', 'View orders', 'orders', 'read'),
    ('order:update', 'Update Orders', 'orders', 'Update orders', 'orders', 'update'),
    ('order:refund', 'Refund Orders', 'orders', 'Issue refunds', 'orders', 'refund'),
    ('order:cancel', 'Cancel Orders', 'orders', 'Cancel orders', 'orders', 'cancel'),
    ('product:read', 'Read Products', 'products', 'View products', 'products', 'read'),
    ('product:create', 'Create Products', 'products', 'Create products', 'products', 'create'),
    ('product:update', 'Update Products', 'products', 'Update products', 'products', 'update'),
    ('product:delete', 'Delete Products', 'products', 'Delete products', 'products', 'delete'),
    ('inventory:read', 'Read Inventory', 'inventory', 'View inventory', 'inventory', 'read'),
    ('inventory:update', 'Update Inventory', 'inventory', 'Update inventory', 'inventory', 'update'),
    ('finance:read', 'Read Finance', 'finance', 'View financial data', 'billing', 'read'),
    ('finance:export', 'Export Finance', 'finance', 'Export financial data', 'billing', 'export'),
    ('audit:read', 'Read Audit Logs', 'audit', 'View audit logs', 'audit', 'read'),
    ('security:manage', 'Manage Security', 'security', 'Manage security settings', 'security', 'manage'),
    ('security:2fa_manage', 'Manage 2FA', 'security', 'Manage user 2FA', 'security', '2fa_manage')
ON CONFLICT DO NOTHING;

-- ====================
-- 16. Role Permissions
-- ====================
-- Super admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin gets broad operational permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'dashboard:view', 'dashboard:export',
    'user:read', 'user:create', 'user:update', 'user:delete', 'user:role_assign', 'user:suspend',
    'employee:invite', 'employee:manage',
    'order:read', 'order:update', 'order:refund', 'order:cancel',
    'product:read', 'product:create', 'product:update', 'product:delete',
    'inventory:read', 'inventory:update',
    'finance:read', 'finance:export',
    'audit:read', 'security:manage'
)
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- Vendor owner gets product/order/inventory permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'product:create', 'product:read', 'product:update', 'product:delete',
    'order:read', 'order:update', 'order:refund',
    'inventory:read', 'inventory:update',
    'employee:invite'
)
WHERE r.name = 'owner' AND r.vendor_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ====================
-- 17. Vendor Staff
-- ====================
INSERT INTO vendor_staff (vendor_id, user_id, role_id, status, invited_by) VALUES
    (1, 2, (SELECT id FROM roles WHERE vendor_id = 1 AND name = 'owner' LIMIT 1), 'active', 1),
    (2, 3, (SELECT id FROM roles WHERE vendor_id = 2 AND name = 'owner' LIMIT 1), 'active', 1);

-- ====================
-- 18. Audit Logs
-- ====================
INSERT INTO audit_logs (vendor_id, user_id, action, resource, metadata) VALUES
    (1, 2, 'create', 'product', '{"product_id": 1, "name": "Summer Dress"}'),
    (1, 2, 'create', 'product', '{"product_id": 2, "name": "Leather Jacket"}'),
    (2, 3, 'create', 'product', '{"product_id": 4, "name": "Gaming Laptop"}'),
    (NULL, 1, 'create', 'vendor', '{"vendor_id": 1, "store_name": "Fashion Hub"}');

-- ====================
-- 19. Bulk Test Data (for load testing)
-- ====================

-- Additional customers (100 more)
INSERT INTO users (email, password_hash, role)
SELECT
    'customer' || gs || '@example.com',
    '$argon2id$v=19$m=65536,t=3,p=4$09S2uHC0Az9MmIZ5sGwycQ$ndXA1w7Y5XncEUr2hU60dHu2F+s9FacUNTphE2o9Jwc',
    'customer'
FROM generate_series(8, 107) gs;

-- Additional products for vendor 1 (50 more fashion items)
INSERT INTO products (vendor_id, category_id, name, slug, description, base_price, is_active)
SELECT
    1,
    (ARRAY[5, 6, 7])[((gs - 1) % 3) + 1],
    'Fashion Item ' || gs,
    'fashion-item-' || gs,
    'Description for fashion item ' || gs,
    (39.99 + (gs % 10) * 10)::numeric(10,2),
    true
FROM generate_series(6, 55) gs;

-- Product variants for new products (2 per product)
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

-- Additional orders (50 more)
INSERT INTO orders (user_id, status, total, net_amount, tax, shipping_cost, total_amount)
SELECT
    (4 + (gs % 100)),
    (ARRAY['pending', 'paid', 'shipped', 'delivered'])[((gs - 1) % 4) + 1]::order_status,
    (100 + (gs * 10))::numeric(10,2),
    (90 + (gs * 10))::numeric(10,2),
    5.00,
    5.00,
    (100 + (gs * 10))::numeric(10,2)
FROM generate_series(4, 53) gs;

-- Order items for new orders
INSERT INTO order_items (order_id, product_variant_id, quantity, price_at_time)
SELECT
    o.id,
    15 + ((o.id - 4) % 50),
    1 + ((o.id - 4) % 3),
    (50 + (o.id * 10))::numeric(10,2)
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

-- More reviews
INSERT INTO reviews (user_id, product_id, rating, comment)
SELECT
    (4 + (gs % 100)),
    (1 + (gs % 10)),
    (3 + (gs % 3)),
    'Review comment for product from user ' || gs
FROM generate_series(4, 33) gs;
