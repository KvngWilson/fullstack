-- =====================================================
-- Migration: Guest checkout + exchange rate contract alignment
-- =====================================================

-- Allow guest orders without a linked account at creation time
ALTER TABLE orders
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_guest_email_unlinked
  ON orders (LOWER(guest_email))
  WHERE user_id IS NULL AND guest_email IS NOT NULL;

-- Bring exchange_rates schema in line with controller/service access patterns
ALTER TABLE exchange_rates
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_exchange_rates_active_pair
  ON exchange_rates (from_currency, to_currency, effective_date DESC)
  WHERE is_active = true;
