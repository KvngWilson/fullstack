-- Migration: Optimistic Locking & Idempotency Keys (v028)
-- Purpose: Sprint 2 data-integrity hardening
--          1. Add version column to product_variants for optimistic locking
--             (prevents overselling under concurrent checkout load)
--          2. Create idempotency_keys table backing the Idempotency-Key
--             middleware (prevents duplicate payments/orders on client retries)
-- Date: 2026-07-24
-- Risk: LOW - Additive only (new column with default, new table)
--
-- Rollback:
--   ALTER TABLE product_variants DROP COLUMN IF EXISTS version;
--   DROP TABLE IF EXISTS idempotency_keys;

BEGIN;

-- =====================================================
-- Optimistic Locking: product_variants.version
-- =====================================================
-- Incremented on every stock mutation. Writers include the version they
-- read in the UPDATE's WHERE clause; a concurrent write makes the UPDATE
-- match zero rows, signalling the caller to re-read and retry.

ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- Idempotency Keys
-- =====================================================
-- One row per (Idempotency-Key, caller scope, endpoint). The unique
-- constraint makes concurrent duplicate submissions race on INSERT so
-- only one request executes; the stored response is replayed to retries.

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idempotency_key VARCHAR(255) NOT NULL,
  scope VARCHAR(255) NOT NULL,
  endpoint TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed')),
  response_status INT,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  CONSTRAINT idempotency_keys_key_scope_endpoint_unique
    UNIQUE (idempotency_key, scope, endpoint)
);

-- Supports periodic cleanup of expired records
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
  ON idempotency_keys (expires_at);

COMMIT;
