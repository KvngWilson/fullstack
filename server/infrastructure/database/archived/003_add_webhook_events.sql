-- Migration: Add webhook event tracking
-- Purpose: Store and deduplicate Easyship webhook events for idempotent processing
-- Strategy: Track event IDs to prevent duplicate shipment status updates
-- Date: March 1, 2026

BEGIN;

-- =====================================================
-- Webhook Events Table
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL UNIQUE, -- External event ID (Easyship)
  provider VARCHAR(50) NOT NULL, -- 'easyship', 'stripe', etc.
  event_type VARCHAR(100) NOT NULL,
  shipment_id VARCHAR(100),
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processed, failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Indexes for efficient lookups
  CONSTRAINT webhook_events_unique_event UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_shipment_id ON webhook_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id ON webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_type ON webhook_events(provider, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- =====================================================
-- Trigger for webhook event timestamps
-- =====================================================
DROP TRIGGER IF EXISTS trigger_webhook_events_updated_at ON webhook_events;
CREATE TRIGGER trigger_webhook_events_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMIT;
