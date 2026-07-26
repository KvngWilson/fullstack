-- Migration: Add shipment fields to orders table
-- Purpose: Support Easyship shipment label creation and tracking
-- Strategy: Add nullable columns first (non-breaking), then enforce constraints
-- Date: March 1, 2026

BEGIN;

-- =====================================================
-- Shipment Status Enum
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
    CREATE TYPE shipment_status AS ENUM (
      'pending',
      'label_created',
      'in_transit',
      'delivered',
      'failed',
      'cancelled'
    );
  END IF;
END $$;

-- =====================================================
-- Extend orders table with shipment fields
-- =====================================================
ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS shipment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipment_status shipment_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS label_url TEXT,
  ADD COLUMN IF NOT EXISTS easyship_rate_id TEXT,
  ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_cost_snapshot NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS shipment_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipment_updated_at TIMESTAMPTZ;

-- =====================================================
-- Indexes for shipment queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_orders_shipment_id ON orders(shipment_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipment_status ON orders(shipment_status);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_shipment_status ON orders(tenant_id, shipment_status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- =====================================================
-- Constraints
-- =====================================================
-- Shipment ID must be unique when set (prevent duplicate shipment creation)
ALTER TABLE IF EXISTS orders
  ADD CONSTRAINT orders_shipment_id_unique UNIQUE(shipment_id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT orders_valid_shipping_cost_snapshot 
    CHECK (shipping_cost_snapshot IS NULL OR shipping_cost_snapshot >= 0);

-- =====================================================
-- Triggers for shipment timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION set_shipment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shipment_status IS DISTINCT FROM OLD.shipment_status THEN
    NEW.shipment_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_shipment_updated_at ON orders;
CREATE TRIGGER trigger_shipment_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_shipment_updated_at();

COMMIT;
