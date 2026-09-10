BEGIN;

CREATE TABLE IF NOT EXISTS email_verifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token
  ON email_verifications (token_hash);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user
  ON email_verifications (user_id);

CREATE INDEX IF NOT EXISTS idx_email_verifications_active
  ON email_verifications (user_id, expires_at)
  WHERE verified_at IS NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token
  ON password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_password_resets_user
  ON password_reset_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user
  ON password_history (user_id, changed_at DESC);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token
  ON refresh_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
  ON refresh_tokens (user_id, expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
