-- Migration: Add constraint enforcement for data integrity (base schema compatible)
-- Enforces business rules at the database level
-- Date: February 28, 2026

BEGIN;

-- ============================================
-- Foreign Key Constraints with Referential Actions
-- ============================================

-- Orders: Prevent deleting users with orders
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_user_id_fkey,
  ADD CONSTRAINT orders_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Order Items: Cascade delete when order is deleted
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_order_id_fkey,
  ADD CONSTRAINT order_items_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Cart Items: Cascade delete when cart is deleted
ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_cart_id_fkey,
  ADD CONSTRAINT cart_items_cart_id_fkey
    FOREIGN KEY (cart_id) REFERENCES carts(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Addresses: Cascade delete when user is deleted
ALTER TABLE addresses
  DROP CONSTRAINT IF EXISTS addresses_user_id_fkey,
  ADD CONSTRAINT addresses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Payments: Restrict deleting orders with payments
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_order_id_fkey,
  ADD CONSTRAINT payments_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- ============================================
-- Check Constraints for Business Rules
-- ============================================

-- Cart Items: Positive quantity
ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_positive_qty,
  ADD CONSTRAINT cart_items_positive_qty CHECK (quantity > 0);

-- Order Items: Positive quantity and prices
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_positive_qty,
  ADD CONSTRAINT order_items_positive_qty CHECK (quantity > 0);

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_positive_price,
  ADD CONSTRAINT order_items_positive_price CHECK (price_at_time >= 0);

-- Product Variants: Non-negative stock
ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS variants_non_negative_stock,
  ADD CONSTRAINT variants_non_negative_stock CHECK (stock >= 0);

-- Reviews: Valid rating range
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_valid_rating,
  ADD CONSTRAINT reviews_valid_rating CHECK (rating BETWEEN 1 AND 5);

-- Payments: Positive amount
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_positive_amount,
  ADD CONSTRAINT payments_positive_amount CHECK (amount >= 0);

-- ============================================
-- NOT NULL Constraints for Required Fields
-- ============================================

-- Orders: Essential fields must not be null
ALTER TABLE orders
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

-- Order Items: Essential fields
ALTER TABLE order_items
  ALTER COLUMN order_id SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL;

-- Cart Items: Essential fields
ALTER TABLE cart_items
  ALTER COLUMN cart_id SET NOT NULL,
  ALTER COLUMN product_variant_id SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL;

-- Addresses: Essential fields
ALTER TABLE addresses
  ALTER COLUMN user_id SET NOT NULL;

-- Payments: Essential fields
ALTER TABLE payments
  ALTER COLUMN order_id SET NOT NULL;

-- Products: Essential fields
ALTER TABLE products
  ALTER COLUMN vendor_id SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL;

COMMIT;

-- Notes:
-- - Skipped wishlists (doesn't exist in base schema)
-- - Skipped saved_cards (doesn't exist in base schema)
-- - Skipped inventory table constraints (table doesn't exist)
-- - Skipped product base_price constraint (column doesn't exist)
-- - Simplified to only target existing tables and columns
