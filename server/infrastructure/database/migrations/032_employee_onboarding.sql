BEGIN;

-- Employee onboarding plans
CREATE TABLE IF NOT EXISTS onboardings (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  manager_id    INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  status        VARCHAR(20)    NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  start_date    DATE           NOT NULL,
  end_date      DATE,
  budget        NUMERIC(10, 2) NOT NULL DEFAULT 5000 CHECK (budget >= 0),
  budget_spent  NUMERIC(10, 2) NOT NULL DEFAULT 0    CHECK (budget_spent >= 0),
  budget_overridden       BOOLEAN        NOT NULL DEFAULT false,
  budget_override_reason  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Onboarding task checklist items
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id             SERIAL PRIMARY KEY,
  onboarding_id  INTEGER     NOT NULL REFERENCES onboardings(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  category       VARCHAR(50)  NOT NULL DEFAULT 'general'
                   CHECK (category IN ('it', 'hr', 'finance', 'office', 'training', 'general')),
  due_day        SMALLINT CHECK (due_day BETWEEN 0 AND 365),
  assigned_to    INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  is_completed   BOOLEAN      NOT NULL DEFAULT false,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboardings_employee    ON onboardings(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboardings_manager     ON onboardings(manager_id);
CREATE INDEX IF NOT EXISTS idx_onboardings_status      ON onboardings(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_parent ON onboarding_tasks(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_status ON onboarding_tasks(onboarding_id, is_completed);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS trg_onboardings_updated ON onboardings;
CREATE TRIGGER trg_onboardings_updated
  BEFORE UPDATE ON onboardings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_onboarding_tasks_updated ON onboarding_tasks;
CREATE TRIGGER trg_onboarding_tasks_updated
  BEFORE UPDATE ON onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
