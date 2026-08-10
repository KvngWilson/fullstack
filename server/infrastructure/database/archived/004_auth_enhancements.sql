-- Migration: Authentication System Enhancements
-- Purpose: Add vendor applications, email verification, password reset, refresh tokens, and session management
-- Date: March 1, 2026

BEGIN;

-- =====================================================
-- Email Verification
-- =====================================================
CREATE TABLE IF NOT EXISTS email_verifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_active 
  ON email_verifications(user_id, expires_at) 
  WHERE verified_at IS NULL;

-- =====================================================
-- Password Reset
-- =====================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS password_history
  ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'password_history'
      AND column_name = 'set_at'
  ) THEN
    UPDATE password_history
    SET changed_at = COALESCE(changed_at, set_at, NOW());
  ELSE
    UPDATE password_history
    SET changed_at = COALESCE(changed_at, NOW());
  END IF;
END $$;

ALTER TABLE IF EXISTS password_history
  ALTER COLUMN changed_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_reset_tokens(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id, changed_at DESC);

-- =====================================================
-- Refresh Tokens (Proper Implementation)
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason VARCHAR(255),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active 
  ON refresh_tokens(user_id, expires_at) 
  WHERE revoked_at IS NULL;

-- =====================================================
-- Vendor Applications
-- =====================================================
CREATE TABLE IF NOT EXISTS vendor_applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  store_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  business_type VARCHAR(50) NOT NULL CHECK (business_type IN ('individual', 'company', 'partnership', 'sole_proprietor')),
  business_name TEXT,
  business_registration VARCHAR(100),
  tax_id VARCHAR(100),
  contact_person TEXT NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address JSONB NOT NULL,
  documents JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'incomplete', 'verification_pending')),
  rejection_reason TEXT,
  admin_notes TEXT,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_applications_status ON vendor_applications(status);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_email ON vendor_applications(email);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_slug ON vendor_applications(slug);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_pending 
  ON vendor_applications(created_at DESC) 
  WHERE status IN ('pending', 'under_review');

-- =====================================================
-- Vendor Onboarding Tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS vendor_onboarding (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id BIGINT NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  onboarding_token VARCHAR(255) UNIQUE,
  steps_completed JSONB DEFAULT '[]'::jsonb,
  current_step VARCHAR(50) DEFAULT 'profile',
  profile_completed BOOLEAN DEFAULT false,
  branding_completed BOOLEAN DEFAULT false,
  payment_completed BOOLEAN DEFAULT false,
  shipping_completed BOOLEAN DEFAULT false,
  policies_completed BOOLEAN DEFAULT false,
  first_product_added BOOLEAN DEFAULT false,
  training_completed BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_onboarding_vendor ON vendor_onboarding(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_onboarding_incomplete 
  ON vendor_onboarding(vendor_id) 
  WHERE onboarding_completed = false;

-- =====================================================
-- Session Management
-- =====================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash VARCHAR(255) NOT NULL UNIQUE,
  refresh_token_id BIGINT REFERENCES refresh_tokens(id) ON DELETE CASCADE,
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active 
  ON user_sessions(user_id, expires_at) 
  WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token_hash);

-- =====================================================
-- Security Audit Log Enhancements
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'security_audit_log' 
    AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE security_audit_log 
      ADD COLUMN IF NOT EXISTS ip_address INET,
      ADD COLUMN IF NOT EXISTS user_agent TEXT,
      ADD COLUMN IF NOT EXISTS device_info JSONB;
  END IF;
END $$;

-- =====================================================
-- Add vendor approval notification tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS vendor_notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_application_id BIGINT REFERENCES vendor_applications(id) ON DELETE CASCADE,
  vendor_id BIGINT REFERENCES vendors(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_notifications_app ON vendor_notifications(vendor_application_id);
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_vendor ON vendor_notifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_unread 
  ON vendor_notifications(vendor_id, created_at DESC) 
  WHERE read_at IS NULL;

-- =====================================================
-- Triggers
-- =====================================================

-- Update vendor_applications updated_at
DROP TRIGGER IF EXISTS trg_vendor_applications_updated ON vendor_applications;
CREATE TRIGGER trg_vendor_applications_updated 
  BEFORE UPDATE ON vendor_applications 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Update vendor_onboarding updated_at
DROP TRIGGER IF EXISTS trg_vendor_onboarding_updated ON vendor_onboarding;
CREATE TRIGGER trg_vendor_onboarding_updated 
  BEFORE UPDATE ON vendor_onboarding 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Check if email verification is required for user
CREATE OR REPLACE FUNCTION email_verification_required(user_id_param BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT email_verified, created_at INTO user_record
  FROM users
  WHERE id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Verification required if not verified and account is less than 30 days old
  RETURN NOT user_record.email_verified AND 
         user_record.created_at > NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql STABLE;

-- Clean expired tokens
CREATE OR REPLACE FUNCTION clean_expired_tokens()
RETURNS void AS $$
BEGIN
  -- Clean expired email verifications
  DELETE FROM email_verifications
  WHERE expires_at < NOW() - INTERVAL '7 days';
  
  -- Clean used and expired password reset tokens
  DELETE FROM password_reset_tokens
  WHERE (used_at IS NOT NULL OR expires_at < NOW()) 
    AND created_at < NOW() - INTERVAL '7 days';
  
  -- Clean expired refresh tokens
  DELETE FROM refresh_tokens
  WHERE (expires_at < NOW() OR revoked_at IS NOT NULL)
    AND created_at < NOW() - INTERVAL '7 days';
  
  -- Clean expired sessions
  DELETE FROM user_sessions
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Performance Indexes
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_email_active_verified 
  ON users(email, is_active, email_verified) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_user_status 
  ON vendors(user_id, status) 
  WHERE deleted_at IS NULL;

COMMIT;
