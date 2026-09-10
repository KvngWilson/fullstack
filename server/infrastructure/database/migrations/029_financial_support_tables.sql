BEGIN;

CREATE TABLE IF NOT EXISTS exchange_rates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate NUMERIC(18, 8) NOT NULL,
  provider VARCHAR(100),
  effective_date DATE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_cached BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_currency, to_currency, effective_date),
  CHECK (from_currency <> to_currency),
  CHECK (rate > 0)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON exchange_rates (from_currency, to_currency, effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_active_lookup
  ON exchange_rates (from_currency, to_currency, is_active, expires_at DESC);

CREATE TABLE IF NOT EXISTS order_exchange_rates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate NUMERIC(18, 8) NOT NULL,
  original_amount BIGINT NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_currency <> to_currency),
  CHECK (rate > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_exchange_rates_order_id
  ON order_exchange_rates (order_id);

CREATE TABLE IF NOT EXISTS order_currency_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC(18, 8) NOT NULL,
  customer_total_cents INTEGER NOT NULL DEFAULT 0,
  base_total_cents INTEGER NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by VARCHAR(100),
  rate_source VARCHAR(50) NOT NULL DEFAULT 'live',
  reason TEXT NOT NULL DEFAULT 'Order creation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (exchange_rate > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_currency_snapshots_order
  ON order_currency_snapshots (order_id);

CREATE INDEX IF NOT EXISTS idx_order_currency_snapshots_currencies
  ON order_currency_snapshots (customer_currency, base_currency);

CREATE TABLE IF NOT EXISTS exchange_rate_sync_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sync_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  currencies_affected TEXT,
  rates_updated INTEGER NOT NULL DEFAULT 0,
  rates_inserted INTEGER NOT NULL DEFAULT 0,
  rates_failed INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  error_message TEXT,
  triggered_by VARCHAR(100) NOT NULL DEFAULT 'scheduled_job',
  duration_seconds INTEGER,
  provider VARCHAR(100) NOT NULL DEFAULT 'mock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_sync_log_time
  ON exchange_rate_sync_log (sync_time DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_sync_log_status
  ON exchange_rate_sync_log (status);

CREATE TABLE IF NOT EXISTS refunds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason VARCHAR(100) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id
  ON refunds (payment_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_exchange_rates_updated ON exchange_rates;
CREATE TRIGGER trg_exchange_rates_updated
  BEFORE UPDATE ON exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_order_currency_snapshots_updated ON order_currency_snapshots;
CREATE TRIGGER trg_order_currency_snapshots_updated
  BEFORE UPDATE ON order_currency_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_refunds_updated ON refunds;
CREATE TRIGGER trg_refunds_updated
  BEFORE UPDATE ON refunds
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMIT;
