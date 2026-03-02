-- Migration: Improve orders table schema normalization
-- Addresses issues: order_number, currency, payment_status, multi-tenant prep, delivery tracking
-- Date: February 28, 2026

BEGIN;

-- Add new payment_status enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_v2') THEN
    CREATE TYPE payment_status_v2 AS ENUM ('pending', 'authorized', 'captured', 'failed', 'refunded');
  END IF;
END $$;

-- Add new columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS currency CHAR(3) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS payment_status payment_status_v2 DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(20) DEFAULT 'unfulfilled',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_id BIGINT REFERENCES addresses(id);

-- Generate order_number for existing orders (format: ORD-YYYYMMDD-ID)
UPDATE orders
SET order_number = 'ORD-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || LPAD(id::TEXT, 6, '0')
WHERE order_number IS NULL;

-- Skipping backfills for columns that don't exist in base schema (net_amount, tax)
-- UPDATE orders
-- SET subtotal_amount = net_amount
-- WHERE subtotal_amount IS NULL AND net_amount IS NOT NULL;
--
-- UPDATE orders
-- SET tax_amount = tax
-- WHERE tax_amount IS NULL AND tax IS NOT NULL;

-- Note: Skipping backfills for columns that don't exist in base schema
-- Application code will populate these fields going forward

-- Make order_number NOT NULL and UNIQUE after backfill
ALTER TABLE orders
  ALTER COLUMN order_number SET NOT NULL,
  ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);

-- Make currency NOT NULL
ALTER TABLE orders
  ALTER COLUMN currency SET NOT NULL;

-- Add check constraints for valid amounts
ALTER TABLE orders
  ADD CONSTRAINT orders_valid_total CHECK (total >= 0),
  ADD CONSTRAINT orders_valid_subtotal CHECK (subtotal_amount >= 0 OR subtotal_amount IS NULL),
  ADD CONSTRAINT orders_valid_tax CHECK (tax_amount >= 0 OR tax_amount IS NULL),
  ADD CONSTRAINT orders_valid_discount CHECK (discount_amount >= 0 OR discount_amount IS NULL),
  ADD CONSTRAINT orders_valid_shipping CHECK (shipping_cost >= 0 OR shipping_cost IS NULL);

-- Add comment explaining denormalized total
COMMENT ON COLUMN orders.total IS 'Order total amount. Use subtotal_amount + tax_amount + shipping_cost - discount_amount for itemized calculation.';
COMMENT ON COLUMN orders.subtotal_amount IS 'Cached subtotal: SUM(order_items.unit_price * order_items.quantity)';
COMMENT ON COLUMN orders.order_number IS 'Human-readable order reference number, unique across system';
COMMENT ON COLUMN orders.currency IS 'ISO 4217 currency code (USD, EUR, GBP, etc.)';
COMMENT ON COLUMN orders.payment_status IS 'Payment processing status, separate from order fulfillment status';
COMMENT ON COLUMN orders.fulfillment_status IS 'Fulfillment status: unfulfilled, partial, fulfilled';

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_order_number TEXT;
  counter INT;
BEGIN
  -- Generate format: ORD-YYYYMMDD-NNNNNN
  SELECT COUNT(*) + 1 INTO counter
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 6, '0');
  
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate order_number on insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_currency ON orders(currency);
CREATE INDEX IF NOT EXISTS idx_orders_estimated_delivery ON orders(estimated_delivery_date) WHERE estimated_delivery_date IS NOT NULL;

COMMIT;
