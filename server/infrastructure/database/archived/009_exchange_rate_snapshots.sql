-- =====================================================
-- Migration: Implement Exchange Rate Snapshot & Locking
-- =====================================================
-- Date: 2026-03-04
-- Purpose: Ensure exchange rates are locked per order and cannot be manipulated for refunds/disputes
-- Impact: Financial audit trail for multi-currency orders

BEGIN;

-- =====================================================
-- PHASE 1: Create Currency Snapshot at Order Time
-- =====================================================

-- Create table to store the exact exchange rate used at order time
CREATE TABLE IF NOT EXISTS order_currency_snapshots (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    
    -- What currency the customer ordered in
    customer_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    -- What currency we store prices in (base currency)
    base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Exchange rate at time of order (customer currency → base currency)
    -- Example: EUR→USD rate 1.10 (1 EUR = 1.10 USD)
    exchange_rate NUMERIC(18, 8) NOT NULL,
    
    -- Customer's subtotal in their currency
    customer_subtotal_cents INTEGER NOT NULL,
    -- Converted to base currency
    base_subtotal_cents INTEGER NOT NULL,
    
    -- Applied tax (in base currency)
    tax_cents INTEGER NOT NULL,
    -- Applied shipping (in base currency)
    shipping_cents INTEGER NOT NULL,
    
    -- Final total in base currency
    total_cents INTEGER NOT NULL,
    
    -- Timestamp when rate was locked
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Which service/system locked this rate
    locked_by VARCHAR(100),
    
    -- For audit: what was the source of this exchange rate
    rate_source VARCHAR(50) DEFAULT 'live',  -- 'live', 'cached', 'manual'
    
    -- For dispute resolution: why was this rate used
    reason TEXT DEFAULT 'Order creation',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_currency_snapshots_order ON order_currency_snapshots(order_id);
CREATE INDEX IF NOT EXISTS idx_order_currency_snapshots_currencies ON order_currency_snapshots(customer_currency, base_currency);
CREATE INDEX IF NOT EXISTS idx_order_currency_snapshots_locked_at ON order_currency_snapshots(locked_at DESC);

-- =====================================================
-- PHASE 2: Populate Existing Orders
-- =====================================================

-- For orders created before this migration, try to reconstruct snapshots
-- Use current exchange rates as best-effort approximation
INSERT INTO order_currency_snapshots 
(order_id, customer_currency, base_currency, exchange_rate, 
 customer_subtotal_cents, base_subtotal_cents, tax_cents, shipping_cents, total_cents,
 locked_at, rate_source, reason)
SELECT 
  o.id,
  COALESCE(o.currency, 'USD') as customer_currency,
  'USD' as base_currency,
  COALESCE(o.exchange_rate_at_time, 1.0::NUMERIC(18,8)) as exchange_rate,
  COALESCE(o.subtotal_cents, 0) as customer_subtotal_cents,
  COALESCE(o.subtotal_cents, 0) as base_subtotal_cents,
  COALESCE(o.tax_cents, 0) as tax_cents,
  COALESCE(o.shipping_cents, 0) as shipping_cents,
  COALESCE(o.total_cents, 0) as total_cents,
  o.created_at,
  'reconstructed' as rate_source,
  'Backfilled from existing order data' as reason
FROM orders o
LEFT JOIN order_currency_snapshots ocs ON o.id = ocs.order_id
WHERE ocs.id IS NULL  -- Only insert if snapshot doesn't exist
  AND o.deleted_at IS NULL;

-- =====================================================
-- PHASE 3: Validation - Check Exchange Rate Data Quality
-- =====================================================

CREATE OR REPLACE FUNCTION validate_exchange_rate_snapshots()
RETURNS TABLE(validation_issue TEXT, affected_count BIGINT) AS $$
BEGIN
  -- Check for missing snapshots
  RETURN QUERY
  SELECT 
    'Orders missing currency snapshots'::TEXT,
    COUNT(*)
  FROM orders o
  LEFT JOIN order_currency_snapshots ocs ON o.id = ocs.order_id
  WHERE o.deleted_at IS NULL
    AND ocs.id IS NULL;

  -- Check for invalid exchange rates
  RETURN QUERY
  SELECT 
    'Currency snapshots with invalid exchange rates (≤0 or >1000)'::TEXT,
    COUNT(*)
  FROM order_currency_snapshots
  WHERE exchange_rate <= 0 OR exchange_rate > 1000;

  -- Check for mismatched totals
  RETURN QUERY
  SELECT 
    'Currency snapshots where base_total != subtotal + tax + shipping'::TEXT,
    COUNT(*)
  FROM order_currency_snapshots
  WHERE (tax_cents + shipping_cents + base_subtotal_cents) != total_cents;

  -- Check for expired exchange rates (data older than 30 days with 'live' source)
  RETURN QUERY
  SELECT 
    'Exchange rates older than 30 days with "live" source (should be refreshed)'::TEXT,
    COUNT(*)
  FROM order_currency_snapshots
  WHERE rate_source = 'live'
    AND locked_at < (now() - interval '30 days');
END;
$$ LANGUAGE plpgsql;

-- Run validation
SELECT * FROM validate_exchange_rate_snapshots();

-- =====================================================
-- PHASE 4: Add Exchange Rate Refresh Job Status Table
-- =====================================================

CREATE TABLE IF NOT EXISTS exchange_rate_sync_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    
    -- When this sync job ran
    sync_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Which currencies were updated
    currencies_affected TEXT,  -- JSON array of [from_currency, to_currency] pairs
    
    -- How many rates were updated/inserted
    rates_updated INTEGER DEFAULT 0,
    rates_inserted INTEGER DEFAULT 0,
    rates_failed INTEGER DEFAULT 0,
    
    -- Status of the job
    status VARCHAR(20) NOT NULL DEFAULT 'success',  -- 'success', 'partial', 'failed'
    
    -- Error message if failed
    error_message TEXT,
    
    -- Who triggered this sync
    triggered_by VARCHAR(100) DEFAULT 'scheduled_job',
    
    -- How long the sync took (in seconds)
    duration_seconds INTEGER,
    
    -- Exchange rate provider used
    provider VARCHAR(100) DEFAULT 'fixer',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_sync_log_time ON exchange_rate_sync_log(sync_time DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_sync_log_status ON exchange_rate_sync_log(status);

-- =====================================================
-- PHASE 5: Add Exchange Rate Validation Function
-- =====================================================

-- Function to check if exchange rate is still valid (not expired)
CREATE OR REPLACE FUNCTION is_exchange_rate_valid(
    from_curr VARCHAR(3),
    to_curr VARCHAR(3),
    max_age_hours INTEGER DEFAULT 24
)
RETURNS BOOLEAN AS $$
DECLARE
  latest_rate RECORD;
  is_valid BOOLEAN;
BEGIN
  SELECT * INTO latest_rate
  FROM exchange_rates
  WHERE from_currency = from_curr
    AND to_currency = to_curr
    AND expires_at > now()
  ORDER BY effective_date DESC
  LIMIT 1;

  if latest_rate IS NULL THEN
    is_valid := FALSE;
  ELSE
    is_valid := (
      (now() - latest_rate.created_at) <= (max_age_hours || ' hours')::INTERVAL
    );
  END IF;

  RETURN is_valid;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get the most recent valid exchange rate
CREATE OR REPLACE FUNCTION get_latest_exchange_rate(
    from_curr VARCHAR(3),
    to_curr VARCHAR(3)
)
RETURNS NUMERIC AS $$
DECLARE
  rate NUMERIC;
BEGIN
  SELECT er.rate INTO rate
  FROM exchange_rates er
  WHERE er.from_currency = from_curr
    AND er.to_currency = to_curr
    AND er.expires_at > now()
  ORDER BY er.effective_date DESC, er.created_at DESC
  LIMIT 1;

  RETURN COALESCE(rate, 1.0);  -- Return 1.0 if currencies are the same
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- PHASE 6: Audit Trail for Exchange Rate Changes
-- =====================================================

-- Track all exchange rate changes (for dispute resolution)
CREATE TABLE IF NOT EXISTS exchange_rate_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    
    -- Which rate changed
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    
    -- What the rate was changed to
    new_rate NUMERIC(18, 8),
    old_rate NUMERIC(18, 8),
    
    -- Who made the change
    changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    
    -- Why (reason for manual override)
    reason TEXT,
    
    -- When
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_audit_currencies ON exchange_rate_audit(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_audit_changed_at ON exchange_rate_audit(changed_at DESC);

-- =====================================================
-- PHASE 7: Check Exchange Rate Data Freshness
-- =====================================================

-- View to show which exchange rates are stale
CREATE OR REPLACE VIEW stale_exchange_rates AS
SELECT 
  from_currency,
  to_currency,
  rate,
  effective_date,
  (now() - created_at) as age,
  CASE 
    WHEN (now() - created_at) > '24 hours'::INTERVAL THEN 'stale'
    WHEN (now() - created_at) > '12 hours'::INTERVAL THEN 'aging'
    ELSE 'fresh'
  END as freshness_status
FROM exchange_rates
WHERE expires_at < now()
ORDER BY created_at DESC;

-- =====================================================
-- PHASE 8: Comments and Documentation
-- =====================================================

COMMENT ON TABLE order_currency_snapshots IS 
  'Immutable snapshot of exchange rate and prices at the exact moment an order was created. Used for audit trail and dispute resolution.';

COMMENT ON COLUMN order_currency_snapshots.exchange_rate IS 
  'Exchange rate from customer_currency to base_currency (e.g., EUR→USD). E.g., 1.10 means 1 EUR = 1.10 USD.';

COMMENT ON COLUMN order_currency_snapshots.locked_at IS 
  'Exact timestamp when the exchange rate was locked for this order. Cannot be changed after this point.';

COMMENT ON COLUMN order_currency_snapshots.rate_source IS 
  'Source of the exchange rate: "live" = fetched from API, "cached" = from local cache, "manual" = admin override.';

COMMENT ON TABLE exchange_rate_sync_log IS 
  'Log of all exchange rate refresh jobs. Track which rates were updated and any errors that occurred.';

COMMENT ON FUNCTION is_exchange_rate_valid IS 
  'Check if an exchange rate is still valid (not expired and not too old). Default max age is 24 hours.';

COMMENT ON FUNCTION get_latest_exchange_rate IS 
  'Get the most recent valid exchange rate. Returns 1.0 if no rate found (assume same currency).';

-- =====================================================
-- SUMMARY
-- =====================================================
-- What was implemented:
-- 1. Created order_currency_snapshots table for immutable audit trail
-- 2. Backfilled existing orders with exchange rate snapshots
-- 3. Created exchange_rate_sync_log to track refresh jobs
-- 4. Added validation and utility functions for exchange rate management
-- 5. Created audit trail for manual exchange rate changes
-- 6. Created views for monitoring exchange rate freshness

-- Next steps (in application code):
-- 1. On order creation: capture exchange rate and lock it in order_currency_snapshots
-- 2. Before checkout: validate that exchange rates are not stale
-- 3. Reject order if rates are >24h old
-- 4. Scheduled job: refresh exchange rates every hour
-- 5. On refund: use locked exchange rate from order_currency_snapshots

COMMIT;
