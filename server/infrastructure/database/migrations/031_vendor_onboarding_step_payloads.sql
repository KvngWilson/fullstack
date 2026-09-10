BEGIN;

CREATE TABLE IF NOT EXISTS vendor_onboarding (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id BIGINT NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  onboarding_token VARCHAR(255) UNIQUE,
  steps_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  step_payloads JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_step VARCHAR(50) DEFAULT 'profile',
  profile_completed BOOLEAN NOT NULL DEFAULT false,
  branding_completed BOOLEAN NOT NULL DEFAULT false,
  payment_completed BOOLEAN NOT NULL DEFAULT false,
  shipping_completed BOOLEAN NOT NULL DEFAULT false,
  policies_completed BOOLEAN NOT NULL DEFAULT false,
  first_product_added BOOLEAN NOT NULL DEFAULT false,
  training_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vendor_onboarding
  ADD COLUMN IF NOT EXISTS step_payloads JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_vendor_onboarding_vendor
  ON vendor_onboarding (vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_onboarding_incomplete
  ON vendor_onboarding (vendor_id)
  WHERE onboarding_completed = false;

DROP TRIGGER IF EXISTS trg_vendor_onboarding_updated ON vendor_onboarding;
CREATE TRIGGER trg_vendor_onboarding_updated
  BEFORE UPDATE ON vendor_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMIT;
