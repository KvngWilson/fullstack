-- Migration: Security Hardening (v027)
-- Purpose: Address security vulnerabilities identified during schema consolidation
--          1. Remove plaintext password field (legacy insecurity)
--          2. Ensure password_hash is NOT NULL (mandatory secure storage)
--          3. Add RLS policies to payments and saved_cards (critical data protection)
-- Date: 2026-07-18
-- Risk: LOW - Backwards compatible drops only unused column, enforces constraints

BEGIN;

-- =====================================================
-- CRITICAL: Remove Plaintext Password Field
-- =====================================================
-- The users.password field is a legacy field that should never be used.
-- All authentication now uses password_hash (bcrypt or similar).
-- Dropping this field prevents accidental use and reduces attack surface.

ALTER TABLE IF EXISTS users
DROP COLUMN IF EXISTS password CASCADE;

-- Ensure password_hash is NOT NULL (all users must have secure password storage)
ALTER TABLE users
ALTER COLUMN password_hash SET NOT NULL;

-- =====================================================
-- RLS Security Hardening: payments and saved_cards
-- =====================================================
-- CRITICAL SECURITY GAP: These sensitive tables lack RLS policies, allowing:
--   - Admins to potentially see other users' payment data
--   - Vendor staff to see customer payment methods
-- This migration closes the gap.

-- Enable RLS on payments table (stores payment processor responses)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users see only payments for their own orders
DROP POLICY IF EXISTS payments_owner_select ON payments;
CREATE POLICY payments_owner_select ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.user_id = current_user_id()
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );

-- Policy 2: Users can insert payments for their own orders
DROP POLICY IF EXISTS payments_owner_insert ON payments;
CREATE POLICY payments_owner_insert ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.user_id = current_user_id()
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );

-- Policy 3: Users can update payments for their own orders (e.g., mark processed)
DROP POLICY IF EXISTS payments_owner_update ON payments;
CREATE POLICY payments_owner_update ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.user_id = current_user_id()
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.user_id = current_user_id()
        AND orders.tenant_id = current_tenant_id()
    )
    OR current_user = 'postgres'
  );

-- Policy 4: Users cannot delete payment records (audit trail)
-- (No DELETE policy created - defaults to deny)

-- Enable RLS on saved_cards table (PCI-DSS critical data)
ALTER TABLE saved_cards ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users see only their own saved cards
DROP POLICY IF EXISTS saved_cards_owner_select ON saved_cards;
CREATE POLICY saved_cards_owner_select ON saved_cards FOR SELECT
  USING (
    (user_id = current_user_id())
    OR current_user = 'postgres'
  );

-- Policy 2: Users can add their own cards
DROP POLICY IF EXISTS saved_cards_owner_insert ON saved_cards;
CREATE POLICY saved_cards_owner_insert ON saved_cards FOR INSERT
  WITH CHECK (
    (user_id = current_user_id())
    OR current_user = 'postgres'
  );

-- Policy 3: Users can update their own cards (e.g., set as primary)
DROP POLICY IF EXISTS saved_cards_owner_update ON saved_cards;
CREATE POLICY saved_cards_owner_update ON saved_cards FOR UPDATE
  USING (
    (user_id = current_user_id())
    OR current_user = 'postgres'
  )
  WITH CHECK (
    (user_id = current_user_id())
    OR current_user = 'postgres'
  );

-- Policy 4: Users can delete their own cards
DROP POLICY IF EXISTS saved_cards_owner_delete ON saved_cards;
CREATE POLICY saved_cards_owner_delete ON saved_cards FOR DELETE
  USING (
    (user_id = current_user_id())
    OR current_user = 'postgres'
  );

-- =====================================================
-- Audit: Verify RLS is Enabled on All Sensitive Tables
-- =====================================================
-- These tables now have complete RLS coverage:
-- ✅ payments (newly hardened)
-- ✅ saved_cards (newly hardened)
-- ✅ orders (existing)
-- ✅ addresses (existing - user data)
-- ✅ carts & cart_items (existing - user data)
--
-- These tables remain without RLS (by design - public catalog):
-- - products (read-only, public catalog)
-- - categories (read-only, public catalog)
-- - vendors (read-only, public list)
-- - reviews (read-only, public reviews)

COMMIT;
