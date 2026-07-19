-- ====================
-- Seed Data for E-Commerce Platform
-- ====================
-- Matches 025_consolidated_schema_baseline.sql schema
-- Comprehensive DDD domain data with proper multi-tenancy

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;

-- ====================
-- 1. Clear existing data
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
-- 2. Tenants (Shared Domain)
-- ====================
INSERT INTO tenants (name, slug, plan, status, subscription_status, max_users, max_products, max_storage_mb, settings, features) VALUES
    ('Default Tenant', 'default', 'enterprise', 'active', 'active', 1000, 10000, 50000, 
     '{"timezone":"UTC","currency":"USD","language":"en"}', 
     '{"multi_vendor":true,"guest_checkout":true,"analytics":true,"reviews":true}'),
    
    ('Fashion Marketplace', 'fashion-marketplace', 'pro', 'active', 'active', 500, 5000, 20000,
     '{"timezone":"America/New_York","currency":"USD","language":"en"}',
     '{"multi_vendor":true,"guest_checkout":true,"analytics":true,"reviews":true}'),
    
    ('Tech Store', 'tech-store', 'starter', 'active', 'active', 100, 1000, 5000,
     '{"timezone":"Europe/London","currency":"GBP","language":"en"}',
     '{"multi_vendor":false,"guest_checkout":true,"analytics":false,"reviews":true}');

-- ====================
-- 3. Users (Identity Domain)
-- ====================
INSERT INTO users (username, email, password_hash, first_name, last_name, role, email_verified, is_verified, is_active) VALUES
    ('admin', 'admin@example.com', '$argon2id$v=19$m=65536,t=3,p=4$s0X7F4nKvaKGdqATQrcxuw$vT7EkeCi6owWfJNV0EMufiAevAv5jUiOG64IK39GtAg', 'Admin', 'User', 'admin', true, true, true),
    ('vendor_fashion', 'vendor1@example.com', '$argon2id$v=19$m=65536,t=3,p=4$nIad+af0ZV66NXmAKQkIGA$qrhFH9wybTvZpYPTm+DbqvJh/YeMYiWO8QbFkEtTQzM', 'John', 'Fashion', 'vendor', true, true, true),
    ('vendor_tech', 'vendor2@example.com', '$argon2id$v=19$m=65536,t=3,p=4$nIad+af0ZV66NXmAKQkIGA$qrhFH9wybTvZpYPTm+DbqvJh/YeMYiWO8QbFkEtTQzM', 'Sarah', 'Tech', 'vendor', true, true, true),
    ('vendor_fashion2', 'vendor3@example.com', '$argon2id$v=19$m=65536,t=3,p=4$nIad+af0ZV66NXmAKQkIGA$qrhFH9wybTvZpYPTm+DbqvJh/YeMYiWO8QbFkEtTQzM', 'Mike', 'Fashion2', 'vendor', true, true, true),
    ('customer1', 'customer1@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'John', 'Doe', 'customer', true, true, true),
    ('customer2', 'customer2@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'Jane', 'Smith', 'customer', true, true, true),
    ('customer3', 'customer3@example.com', '$argon2id$v=19$m=65536,t=3,p=4$9vG2da3l0sNnIyE7oorOCA$xU5XeKLGcHzUIyc35sVvd1y+A/pVioQEP/OvqkFrm14', 'Bob', 'Johnson', 'customer', true, true, true),
    ('support', 'support@example.com', '$argon2id$v=19$m=65536,t=3,p=4$ldTAhfjf8cT9Tzq5hc8k5A$USFSVFUM5kW27VvzmuZ4I+JoUhW3nNzNxWWlqgtzllw', 'Support', 'Team', 'support', true, true, true);

-- ====================
-- 4. Tenant Users (Shared Domain - Multi-tenancy)
-- ====================
INSERT INTO tenant_users (tenant_id, user_id, role, is_active, invited_by, joined_at) VALUES
    -- Default Tenant
    (1, 1, 'admin', true, NULL, NOW()),
    (1, 2, 'vendor', true, 1, NOW()),
    (1, 3, 'vendor', true, 1, NOW()),
    (1, 4, 'vendor', true, 1, NOW()),
    (1, 5, 'member', true, 1, NOW()),
    (1, 6, 'member', true, 1, NOW()),
    (1, 7, 'member', true, 1, NOW()),
    (1, 8, 'support', true, 1, NOW()),
    -- Fashion Marketplace
    (2, 1, 'admin', true, NULL, NOW()),
    (2, 2, 'vendor_manager', true, 1, NOW()),
    (2, 5, 'member', true, 1, NOW()),
    -- Tech Store
    (3, 1, 'admin', true, NULL, NOW()),
    (3, 3, 'vendor_manager', true, 1, NOW());

-- ====================
-- 5. Vendors (Vendor Domain)
-- ====================
INSERT INTO vendors (user_id, tenant_id, store_name, slug, description, status) VALUES
    (2, 1, 'Fashion Hub', 'fashion-hub', 'Premium fashion and accessories for all seasons', 'active'),
    (3, 1, 'Tech Store', 'tech-store', 'Latest electronics and gadgets with expert support', 'active'),
    (4, 2, 'Fashion Marketplace', 'fashion-marketplace-vendor', 'Designer fashion and exclusive collections', 'active');

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
    (2, 'Womens Clothing', 'womens-clothing', 'fashion.womens_clothing'),
    (3, 'Electronics', 'electronics-3', 'electronics'),
    (3, 'Computers', 'computers', 'electronics.computers');

-- ====================
-- 7. Products (Catalog Domain)
-- ====================
INSERT INTO products (vendor_id, tenant_id, category_id, name, slug, description, brand, base_price, is_active, created_by) VALUES
    (1, 1, 6, 'Summer Dress', 'summer-dress', 'Lightweight cotton summer dress perfect for warm weather', 'Elegance Wear', 79.99, true, 2),
    (1, 1, 5, 'Leather Jacket', 'leather-jacket', 'Genuine leather jacket for men with modern styling', 'Style Co', 299.99, true, 2),
    (1, 1, 7, 'Designer Handbag', 'designer-handbag', 'Premium leather handbag with premium craftsmanship', 'Luxe Bags', 449.99, true, 2),
    (2, 1, 2, 'Gaming Laptop', 'gaming-laptop', 'High-performance gaming laptop with RTX 4090 GPU', 'TechPro', 1299.99, true, 3),
    (2, 1, 3, 'Smartphone Pro', 'smartphone-pro', 'Latest flagship smartphone with advanced features', 'PhoneMax', 899.99, true, 3),
    (3, 2, 8, 'Casual Dress', 'casual-dress', 'Comfortable casual dress for everyday wear', 'Comfort Wear', 59.99, true, 4),
    (3, 3, 11, 'Workstation PC', 'workstation-pc', 'Professional workstation computer for content creators', 'WorkTech', 1999.99, true, 4);

-- ====================
-- 8. Product Variants (Catalog Domain)
-- ====================
INSERT INTO product_variants (product_id, sku, price_cents, stock, attributes) VALUES
    -- Summer Dress
    (1, 'DRESS-S-BLUE-001', 7999, 15, '{"size":"S","color":"Blue"}'),
    (1, 'DRESS-M-BLUE-001', 7999, 20, '{"size":"M","color":"Blue"}'),
    (1, 'DRESS-L-BLUE-001', 7999, 10, '{"size":"L","color":"Blue"}'),
    (1, 'DRESS-XL-BLUE-001', 7999, 8, '{"size":"XL","color":"Blue"}'),
    (1, 'DRESS-S-RED-001', 7999, 12, '{"size":"S","color":"Red"}'),
    (1, 'DRESS-M-RED-001', 7999, 18, '{"size":"M","color":"Red"}'),
    
    -- Leather Jacket
    (2, 'JACKET-S-BLACK-002', 29999, 5, '{"size":"S","color":"Black"}'),
    (2, 'JACKET-M-BLACK-002', 29999, 8, '{"size":"M","color":"Black"}'),
    (2, 'JACKET-L-BLACK-002', 29999, 6, '{"size":"L","color":"Black"}'),
    (2, 'JACKET-XL-BLACK-002', 29999, 3, '{"size":"XL","color":"Black"}'),
    (2, 'JACKET-M-BROWN-002', 29999, 4, '{"size":"M","color":"Brown"}'),
    
    -- Designer Handbag
    (3, 'BAG-OS-BROWN-003', 44999, 12, '{"size":"One Size","color":"Brown"}'),
    (3, 'BAG-OS-BLACK-003', 44999, 15, '{"size":"One Size","color":"Black"}'),
    (3, 'BAG-OS-RED-003', 44999, 8, '{"size":"One Size","color":"Red"}'),
    
    -- Gaming Laptop
    (4, 'LAPTOP-16GB-512GB-004', 129999, 8, '{"ram":"16GB","storage":"512GB SSD","gpu":"RTX 4070"}'),
    (4, 'LAPTOP-32GB-1TB-004', 179999, 5, '{"ram":"32GB","storage":"1TB SSD","gpu":"RTX 4090"}'),
    (4, 'LAPTOP-16GB-256GB-004', 99999, 12, '{"ram":"16GB","storage":"256GB SSD","gpu":"RTX 4060"}'),
    
    -- Smartphone
    (5, 'PHONE-128GB-BLACK-005', 89999, 25, '{"storage":"128GB","color":"Black","display":"6.1in"}'),
    (5, 'PHONE-256GB-BLACK-005', 99999, 18, '{"storage":"256GB","color":"Black","display":"6.1in"}'),
    (5, 'PHONE-512GB-BLACK-005', 109999, 10, '{"storage":"512GB","color":"Black","display":"6.1in"}'),
    (5, 'PHONE-128GB-WHITE-005', 89999, 20, '{"storage":"128GB","color":"White","display":"6.1in"}'),
    (5, 'PHONE-256GB-WHITE-005', 99999, 15, '{"storage":"256GB","color":"White","display":"6.1in"}'),
    
    -- Casual Dress
    (6, 'CASUAL-XS-PINK-006', 5999, 20, '{"size":"XS","color":"Pink"}'),
    (6, 'CASUAL-S-PINK-006', 5999, 25, '{"size":"S","color":"Pink"}'),
    (6, 'CASUAL-M-PINK-006', 5999, 22, '{"size":"M","color":"Pink"}'),
    (6, 'CASUAL-L-PINK-006', 5999, 18, '{"size":"L","color":"Pink"}'),
    (6, 'CASUAL-S-GRAY-006', 5999, 20, '{"size":"S","color":"Gray"}'),
    
    -- Workstation PC
    (7, 'WORKSTATION-64GB-2TB-007', 199999, 4, '{"ram":"64GB","storage":"2TB SSD","processor":"Threadripper"}'),
    (7, 'WORKSTATION-32GB-1TB-007', 149999, 6, '{"ram":"32GB","storage":"1TB SSD","processor":"Xeon"}');

-- ====================
-- 9. Inventory (Catalog Domain)
-- ====================
INSERT INTO inventory (product_id, product_variant_id, stock_quantity, reserved_quantity, is_available)
SELECT p.id, pv.id, pv.stock, 0, true
FROM product_variants pv
JOIN products p ON p.id = pv.product_id;

-- ====================
-- 10. Addresses (Ordering Domain)
-- ====================
INSERT INTO addresses (user_id, tenant_id, type, first_name, last_name, email, phone, street, city, state, postal_code, country, is_primary) VALUES
    (5, 1, 'shipping', 'John', 'Doe', 'john@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA', true),
    (5, 1, 'billing', 'John', 'Doe', 'john@example.com', '555-0101', '456 Park Ave', 'New York', 'NY', '10002', 'USA', false),
    (6, 1, 'shipping', 'Jane', 'Smith', 'jane@example.com', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA', true),
    (7, 1, 'shipping', 'Bob', 'Johnson', 'bob@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA', true);

-- ====================
-- 11. Carts (Ordering Domain)
-- ====================
INSERT INTO carts (user_id, tenant_id, status) VALUES
    (5, 1, 'active'),
    (6, 1, 'active'),
    (7, 1, 'active');

-- ====================
-- 12. Cart Items (Ordering Domain)
-- ====================
INSERT INTO cart_items (cart_id, tenant_id, product_id, product_variant_id, quantity, unit_price_cents) VALUES
    (1, 1, 1, 1, 2, 7999),
    (1, 1, 3, 13, 1, 44999),
    (2, 1, 5, 19, 1, 89999),
    (3, 1, 4, 15, 1, 129999);

-- ====================
-- 13. Orders (Ordering Domain)
-- ====================
INSERT INTO orders (user_id, tenant_id, order_number, status, payment_status, fulfillment_status, currency, subtotal_cents, tax_cents, shipping_cents, discount_cents, total_cents, shipping_first_name, shipping_last_name, shipping_email, shipping_phone, shipping_street_address, shipping_city, shipping_state, shipping_postal_code, shipping_country) VALUES
    (5, 1, 'ORD-20260719-0001', 'delivered', 'succeeded', 'fulfilled', 'USD', 52997, 4240, 7000, 0, 64237, 'John', 'Doe', 'john@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (6, 1, 'ORD-20260719-0002', 'shipped', 'succeeded', 'partial', 'USD', 89999, 7200, 0, 0, 97199, 'Jane', 'Smith', 'jane@example.com', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA'),
    (7, 1, 'ORD-20260719-0003', 'pending', 'pending', 'unfulfilled', 'USD', 129999, 10400, 0, 0, 140399, 'Bob', 'Johnson', 'bob@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA'),
    (5, 2, 'ORD-20260719-0004', 'paid', 'succeeded', 'unfulfilled', 'USD', 5999, 480, 0, 0, 6479, 'John', 'Doe', 'john@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (7, 3, 'ORD-20260719-0005', 'processing', 'pending', 'unfulfilled', 'GBP', 199999, 40000, 15000, 10000, 244999, 'Bob', 'Johnson', 'bob@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA');

-- ====================
-- 14. Order Items (Ordering Domain)
-- ====================
INSERT INTO order_items (order_id, product_id, product_variant_id, quantity, unit_price_cents, subtotal_cents) VALUES
    (1, 1, 1, 2, 7999, 15998),
    (1, 3, 13, 1, 44999, 44999),
    (2, 5, 19, 1, 89999, 89999),
    (3, 4, 15, 1, 129999, 129999),
    (4, 6, 26, 1, 5999, 5999),
    (5, 7, 31, 1, 199999, 199999);

-- ====================
-- 15. Order Addresses (Ordering Domain)
-- ====================
INSERT INTO order_addresses (order_id, type, first_name, last_name, email, phone, street, city, state, postal_code, country) VALUES
    (1, 'shipping', 'John', 'Doe', 'john@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (1, 'billing', 'John', 'Doe', 'john@example.com', '555-0101', '456 Park Ave', 'New York', 'NY', '10002', 'USA'),
    (2, 'shipping', 'Jane', 'Smith', 'jane@example.com', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA'),
    (2, 'billing', 'Jane', 'Smith', 'jane@example.com', '555-0102', '789 Pine Rd', 'Los Angeles', 'CA', '90001', 'USA'),
    (3, 'shipping', 'Bob', 'Johnson', 'bob@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA'),
    (3, 'billing', 'Bob', 'Johnson', 'bob@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA'),
    (4, 'shipping', 'John', 'Doe', 'john@example.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'USA'),
    (4, 'billing', 'John', 'Doe', 'john@example.com', '555-0101', '456 Park Ave', 'New York', 'NY', '10002', 'USA'),
    (5, 'shipping', 'Bob', 'Johnson', 'bob@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA'),
    (5, 'billing', 'Bob', 'Johnson', 'bob@example.com', '555-0103', '321 Elm St', 'Chicago', 'IL', '60601', 'USA');

-- ====================
-- 16. Payments (Payment Domain)
-- ====================
INSERT INTO payments (order_id, stripe_payment_id, processor, status, amount_cents, currency) VALUES
    (1, 'pi_1234567890abcdef', 'stripe', 'succeeded', 64237, 'USD'),
    (2, 'pi_0987654321fedcba', 'stripe', 'succeeded', 97199, 'USD'),
    (3, 'pi_1111222233334444', 'stripe', 'pending', 140399, 'USD'),
    (4, 'pi_2222333344445555', 'stripe', 'succeeded', 6479, 'USD'),
    (5, 'pi_3333444455556666', 'stripe', 'pending', 244999, 'GBP');

-- ====================
-- 17. Reviews
-- ====================
INSERT INTO reviews (user_id, product_id, rating, title, comment) VALUES
    (5, 1, 5, 'Perfect fit and quality!', 'Beautiful dress, fits perfectly and the material is high quality!'),
    (5, 3, 4, 'Great quality handbag', 'Great quality handbag, very well made and durable'),
    (6, 5, 5, 'Amazing phone', 'Amazing phone with excellent camera and performance'),
    (5, 6, 5, 'Excellent casual dress', 'Perfect casual dress for everyday wear, very comfortable'),
    (7, 7, 5, 'Outstanding workstation', 'Excellent workstation, highly recommend for professional work');

-- ====================
-- 18. Wishlists
-- ====================
INSERT INTO wishlists (user_id, product_id) VALUES
    (5, 2),
    (6, 4),
    (7, 3),
    (5, 5);

-- ====================
-- 19. Saved Cards
-- ====================
INSERT INTO saved_cards (user_id, card_brand, last_four, exp_month, exp_year, card_token, is_primary) VALUES
    (5, 'Visa', '4242', 12, 2027, 'tok_visa_1234567890', true),
    (5, 'Mastercard', '5555', 8, 2026, 'tok_mc_1234567890', false),
    (6, 'Amex', '3782', 3, 2028, 'tok_amex_1234567890', true),
    (7, 'Visa', '1111', 6, 2025, 'tok_visa_9876543210', true);

-- ====================
-- 20. Roles (RBAC)
-- ====================
INSERT INTO roles (vendor_id, code, name, description, hierarchy_level, is_system, is_active) VALUES
    (NULL, 'ADMIN', 'Administrator', 'Full system access', 100, true, true),
    (NULL, 'MANAGER', 'Manager', 'Platform manager', 50, true, true),
    (NULL, 'SUPPORT', 'Support Staff', 'Customer support', 20, true, true),
    (1, 'VENDOR_OWNER', 'Vendor Owner', 'Vendor owner with full control', 100, true, true),
    (1, 'VENDOR_MANAGER', 'Vendor Manager', 'Vendor staff manager', 50, false, true),
    (2, 'VENDOR_OWNER', 'Vendor Owner', 'Vendor owner with full control', 100, true, true),
    (3, 'VENDOR_OWNER', 'Vendor Owner', 'Vendor owner with full control', 100, true, true)
ON CONFLICT DO NOTHING;

-- ====================
-- 21. Permissions
-- ====================
INSERT INTO permissions (code, name, description, category, resource, action, is_active) VALUES
    ('PRODUCT_CREATE', 'Create Product', 'Can create new products', 'products', 'products', 'create', true),
    ('PRODUCT_READ', 'Read Product', 'Can view products', 'products', 'products', 'read', true),
    ('PRODUCT_UPDATE', 'Update Product', 'Can edit products', 'products', 'products', 'update', true),
    ('PRODUCT_DELETE', 'Delete Product', 'Can delete products', 'products', 'products', 'delete', true),
    ('ORDER_READ', 'Read Order', 'Can view orders', 'orders', 'orders', 'read', true),
    ('ORDER_UPDATE', 'Update Order', 'Can update order status', 'orders', 'orders', 'update', true),
    ('ORDER_REFUND', 'Refund Order', 'Can issue refunds', 'orders', 'orders', 'refund', true),
    ('INVENTORY_READ', 'Read Inventory', 'Can view inventory', 'inventory', 'inventory', 'read', true),
    ('INVENTORY_UPDATE', 'Update Inventory', 'Can update stock levels', 'inventory', 'inventory', 'update', true),
    ('STAFF_INVITE', 'Invite Staff', 'Can invite new staff', 'staff', 'staff', 'invite', true),
    ('STAFF_REMOVE', 'Remove Staff', 'Can remove staff', 'staff', 'staff', 'remove', true),
    ('ANALYTICS_READ', 'Read Analytics', 'Can view analytics', 'analytics', 'analytics', 'read', true),
    ('BILLING_READ', 'Read Billing', 'Can view billing', 'billing', 'billing', 'read', true),
    ('BILLING_UPDATE', 'Update Billing', 'Can update billing', 'billing', 'billing', 'update', true)
ON CONFLICT DO NOTHING;

-- ====================
-- 22. Role Permissions
-- ====================
-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Vendor owners get product/order/inventory permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource IN ('products', 'orders', 'inventory', 'staff', 'analytics', 'billing')
WHERE r.code = 'VENDOR_OWNER' AND r.vendor_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ====================
-- 23. Vendor Staff
-- ====================
INSERT INTO vendor_staff (vendor_id, user_id, role_id, status, invited_by) VALUES
    (1, 2, (SELECT id FROM roles WHERE vendor_id = 1 AND code = 'VENDOR_OWNER' LIMIT 1), 'active', 1),
    (2, 3, (SELECT id FROM roles WHERE vendor_id = 2 AND code = 'VENDOR_OWNER' LIMIT 1), 'active', 1),
    (3, 4, (SELECT id FROM roles WHERE vendor_id = 3 AND code = 'VENDOR_OWNER' LIMIT 1), 'active', 1);

-- ====================
-- 24. Audit Logs
-- ====================
INSERT INTO audit_logs (vendor_id, user_id, action, resource, metadata) VALUES
    (1, 2, 'create', 'product', '{"product_id":1,"name":"Summer Dress","sku":"DRESS-S-BLUE-001"}'),
    (1, 2, 'create', 'product', '{"product_id":2,"name":"Leather Jacket","sku":"JACKET-S-BLACK-002"}'),
    (2, 3, 'create', 'product', '{"product_id":4,"name":"Gaming Laptop","sku":"LAPTOP-16GB-512GB-004"}'),
    (1, 2, 'update', 'product', '{"product_id":1,"status":"active","updated_by":2}'),
    (NULL, 1, 'create', 'vendor', '{"vendor_id":1,"store_name":"Fashion Hub"}'),
    (3, 4, 'create', 'product', '{"product_id":6,"name":"Casual Dress"}');
