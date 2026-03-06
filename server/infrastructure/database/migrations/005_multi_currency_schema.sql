-- =====================================================
-- Migration: Add Multi-Currency Support
-- =====================================================
-- Date: 2026-03-02
-- Purpose: Add currency support to orders and exchange rates

-- =====================================================
-- 1. CREATE SYSTEM CONFIG TABLE
-- =====================================================
-- Stores global system settings including base currency
CREATE TABLE IF NOT EXISTS system_config (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by BIGINT REFERENCES users(id)
);

-- Insert default base currency
INSERT INTO system_config (key, value, description)
VALUES ('base_currency', 'USD', 'Base currency for all monetary calculations')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 2. CREATE EXCHANGE RATES TABLE
-- =====================================================
-- Stores historical and current exchange rates
CREATE TABLE IF NOT EXISTS exchange_rates (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,           -- e.g., USD
    to_currency VARCHAR(3) NOT NULL,             -- e.g., EUR
    rate NUMERIC(18, 8) NOT NULL,                -- Exchange rate to 8 decimal places
    provider VARCHAR(100),                        -- e.g., 'fixer', 'alphavantage'
    effective_date DATE NOT NULL,                 -- Date rate became effective
    expires_at TIMESTAMPTZ NOT NULL,              -- When this rate expires (for caching)
    is_cached BOOLEAN DEFAULT false,              -- Whether this is from cache
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    UNIQUE (from_currency, to_currency, effective_date),
    CHECK (from_currency != to_currency),
    CHECK (rate > 0),
    CHECK (expires_at > now())
);

-- Index for rapid lookups
CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
ON exchange_rates (from_currency, to_currency, effective_date DESC);

-- =====================================================
-- 3. MODIFY ORDERS TABLE FOR CURRENCY
-- =====================================================
-- Add currency columns to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER NOT NULL DEFAULT 0,     -- Amount in minor units (cents)
ADD COLUMN IF NOT EXISTS tax_cents INTEGER NOT NULL DEFAULT 0,          -- Amount in minor units
ADD COLUMN IF NOT EXISTS shipping_cents INTEGER NOT NULL DEFAULT 0,     -- Amount in minor units
ADD COLUMN IF NOT EXISTS total_cents INTEGER NOT NULL DEFAULT 0,        -- Total in minor units
ADD COLUMN IF NOT EXISTS exchange_rate_at_time NUMERIC(18, 8),       -- Snapshot of exchange rate
ADD COLUMN IF NOT EXISTS exchange_rate_locked_at TIMESTAMPTZ;        -- When rate was locked

-- Monetary columns are stored in minor units; legacy major-unit columns were removed.
COMMENT ON COLUMN orders.currency IS 'Currency code (ISO 4217) at time of order creation';
COMMENT ON COLUMN orders.subtotal_cents IS 'Subtotal in minor units (cents for USD, pence for GBP, etc)';
COMMENT ON COLUMN orders.tax_cents IS 'Tax in minor units';
COMMENT ON COLUMN orders.shipping_cents IS 'Shipping cost in minor units';
COMMENT ON COLUMN orders.total_cents IS 'Total order amount in minor units';

-- =====================================================
-- 4. CREATE ORDER EXCHANGE RATE LOCKING TABLE
-- =====================================================
-- Stores locked exchange rates for orders (immutable for audit trail)
CREATE TABLE IF NOT EXISTS order_exchange_rates (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE UNIQUE NOT NULL,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate NUMERIC(18, 8) NOT NULL,
    original_amount BIGINT,                  -- Original amount in minor units
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_currencies CHECK (from_currency != to_currency),
    CONSTRAINT positive_rate CHECK (rate > 0)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_order_exchange_rates_order_id
ON order_exchange_rates (order_id);

-- =====================================================
-- 5. MODIFY PRODUCT_VARIANTS FOR AMOUNT STORAGE
-- =====================================================
-- Convert price to minor units and add currency awareness
ALTER TABLE product_variants
DROP COLUMN IF EXISTS price,
ADD COLUMN IF NOT EXISTS price_minor_units INTEGER NOT NULL DEFAULT 0, -- Price in minor units
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS is_price_locked BOOLEAN DEFAULT false;       -- Prevent price tampering

COMMENT ON COLUMN product_variants.price_minor_units IS 'Price in minor units (e.g., cents for USD)';
COMMENT ON COLUMN product_variants.currency IS 'Currency of the price at creation time';

-- =====================================================
-- 6. ADD TRIGGER FOR EXCHANGE RATE EXPIRATION
-- =====================================================
CREATE OR REPLACE FUNCTION clean_expired_exchange_rates()
RETURNS void AS $$
BEGIN
    DELETE FROM exchange_rates
    WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_orders_currency 
ON orders(currency);

CREATE INDEX IF NOT EXISTS idx_product_variants_currency 
ON product_variants(currency);

CREATE INDEX IF NOT EXISTS idx_product_variants_price 
ON product_variants(price_minor_units);

-- =====================================================
-- Migration Status
-- =====================================================
-- Status: READY FOR TESTING
-- Next: Write failing tests for currency functionality
