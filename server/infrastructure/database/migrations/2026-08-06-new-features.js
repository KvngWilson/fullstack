/**
 * Migration: Add support for new features
 * Date: 2026-08-06
 * 
 * Adds database schema for:
 * 1. Review moderation
 * 2. Vendor commissions and payouts
 * 3. Analytics tables
 * 4. WebSocket session tracking
 */

module.exports = {
  id: "2026-08-06-new-features",
  name: "Add new features support",
  
  async up(client) {
    // Add review moderation columns
    await client.query(`
      ALTER TABLE IF EXISTS reviews
      ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
      ADD COLUMN IF NOT EXISTS moderation_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS moderator_id BIGINT REFERENCES users(id);
    `);

    // Create review moderation audit table
    await client.query(`
      CREATE TABLE IF NOT EXISTS review_moderation_audit (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        review_id BIGINT NOT NULL REFERENCES reviews(id),
        moderator_id BIGINT NOT NULL REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_review_moderation_audit_review_id 
        ON review_moderation_audit(review_id);
    `);

    // Create vendor commission settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_commission_settings (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        vendor_id BIGINT NOT NULL UNIQUE REFERENCES vendors(id),
        commission_rate NUMERIC(5,2) NOT NULL DEFAULT 15,
        effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Create vendor payouts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_payouts (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        vendor_id BIGINT NOT NULL REFERENCES vendors(id),
        amount NUMERIC(12,2) NOT NULL,
        bank_account_id VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        reference_number VARCHAR(100),
        requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor_id 
        ON vendor_payouts(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status 
        ON vendor_payouts(status);
    `);

    // Create analytics tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_metrics (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        metric_type VARCHAR(100) NOT NULL,
        metric_name VARCHAR(100) NOT NULL,
        value NUMERIC(20,2) NOT NULL,
        unit VARCHAR(50),
        period VARCHAR(20) NOT NULL,
        vendor_id BIGINT REFERENCES vendors(id),
        metadata JSONB,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_metrics_type 
        ON analytics_metrics(metric_type, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_metrics_vendor 
        ON analytics_metrics(vendor_id, timestamp DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_snapshots (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        snapshot_type VARCHAR(100) NOT NULL,
        period_start TIMESTAMPTZ NOT NULL,
        period_end TIMESTAMPTZ NOT NULL,
        data JSONB NOT NULL,
        vendor_id BIGINT REFERENCES vendors(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_type 
        ON analytics_snapshots(snapshot_type, period_end DESC);
    `);

    // Enhance vendors table
    await client.query(`
      ALTER TABLE vendors
      ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'registration',
      ADD COLUMN IF NOT EXISTS admin_notes TEXT,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
      ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS bank_account_last4 VARCHAR(4);
    `);

    // WebSocket sessions tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS websocket_sessions (
        id VARCHAR(100) PRIMARY KEY,
        user_id BIGINT REFERENCES users(id),
        socket_id VARCHAR(255) NOT NULL,
        connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        disconnected_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS idx_websocket_sessions_user_id 
        ON websocket_sessions(user_id, is_active);
    `);
  },

  async down(client) {
    // Rollback in reverse order
    await client.query("DROP INDEX IF EXISTS idx_websocket_sessions_user_id");
    await client.query("DROP TABLE IF EXISTS websocket_sessions");

    await client.query("DROP INDEX IF EXISTS idx_analytics_snapshots_type");
    await client.query("DROP TABLE IF EXISTS analytics_snapshots");
    await client.query("DROP INDEX IF EXISTS idx_analytics_metrics_vendor");
    await client.query("DROP INDEX IF EXISTS idx_analytics_metrics_type");
    await client.query("DROP TABLE IF EXISTS analytics_metrics");

    await client.query("DROP INDEX IF EXISTS idx_vendor_payouts_status");
    await client.query("DROP INDEX IF EXISTS idx_vendor_payouts_vendor_id");
    await client.query("DROP TABLE IF EXISTS vendor_payouts");
    await client.query("DROP TABLE IF EXISTS vendor_commission_settings");

    await client.query("DROP INDEX IF EXISTS idx_review_moderation_audit_review_id");
    await client.query("DROP TABLE IF EXISTS review_moderation_audit");

    await client.query(`
      ALTER TABLE reviews
      DROP COLUMN IF EXISTS moderation_status,
      DROP COLUMN IF EXISTS moderation_notes,
      DROP COLUMN IF EXISTS moderation_at,
      DROP COLUMN IF EXISTS moderator_id;
    `);

    await client.query(`
      ALTER TABLE vendors
      DROP COLUMN IF EXISTS onboarding_status,
      DROP COLUMN IF EXISTS admin_notes,
      DROP COLUMN IF EXISTS rejection_reason,
      DROP COLUMN IF EXISTS suspension_reason,
      DROP COLUMN IF EXISTS activated_at,
      DROP COLUMN IF EXISTS suspended_at,
      DROP COLUMN IF EXISTS bank_account_last4;
    `);
  }
};
