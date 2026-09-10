BEGIN;

ALTER TABLE IF EXISTS reviews
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS moderation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderator_id BIGINT REFERENCES users(id);

CREATE TABLE IF NOT EXISTS review_moderation_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  moderator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(50) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_moderation_audit_review_id
  ON review_moderation_audit (review_id);

CREATE TABLE IF NOT EXISTS vendor_commission_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id BIGINT NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 15,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_payouts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  bank_account_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reference_number VARCHAR(100),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor_id
  ON vendor_payouts (vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status
  ON vendor_payouts (status);

CREATE TABLE IF NOT EXISTS analytics_metrics (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metric_type VARCHAR(100) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  value NUMERIC(20,2) NOT NULL,
  unit VARCHAR(50),
  period VARCHAR(20) NOT NULL,
  vendor_id BIGINT REFERENCES vendors(id) ON DELETE CASCADE,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_metrics_type
  ON analytics_metrics (metric_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_metrics_vendor
  ON analytics_metrics (vendor_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_type VARCHAR(100) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL,
  vendor_id BIGINT REFERENCES vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_type
  ON analytics_snapshots (snapshot_type, period_end DESC);

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'registration',
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_account_last4 VARCHAR(4);

CREATE TABLE IF NOT EXISTS websocket_sessions (
  id VARCHAR(100) PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  socket_id VARCHAR(255) NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_websocket_sessions_user_id
  ON websocket_sessions (user_id, is_active);

COMMIT;
