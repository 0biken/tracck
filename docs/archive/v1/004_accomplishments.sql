-- Tracck Migration 004 — Accomplishments
-- AI-extracted accomplishments awaiting user confirmation.

CREATE TABLE IF NOT EXISTS accomplishments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_post_id       UUID REFERENCES raw_posts(id) ON DELETE SET NULL,
  extracted_text    TEXT NOT NULL,
  bullet_text       TEXT NOT NULL,
  role_tag          TEXT NOT NULL,
  ats_keywords      TEXT[] NOT NULL DEFAULT '{}',
  metric_flag       BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_score  DECIMAL(4,3) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  status            TEXT NOT NULL DEFAULT 'pending',
  status_changed_at TIMESTAMPTZ,
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accomplishments
  ADD CONSTRAINT accomplishments_role_tag_valid CHECK (
    role_tag IN ('developer', 'devrel', 'smm', 'virtual_assistant', 'ui_designer', 'data_analyst')
  );

ALTER TABLE accomplishments
  ADD CONSTRAINT accomplishments_status_valid CHECK (
    status IN ('pending', 'confirmed', 'dismissed', 'low_confidence')
  );

CREATE INDEX IF NOT EXISTS idx_accomplishments_user_id ON accomplishments(user_id);
CREATE INDEX IF NOT EXISTS idx_accomplishments_status ON accomplishments(status);
CREATE INDEX IF NOT EXISTS idx_accomplishments_user_status ON accomplishments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_accomplishments_role_tag ON accomplishments(role_tag);
CREATE INDEX IF NOT EXISTS idx_accomplishments_detected_at ON accomplishments(detected_at DESC);

COMMENT ON COLUMN accomplishments.metric_flag IS 'TRUE = bullet contains or needs a quantifiable metric. User prompted to confirm.';
COMMENT ON COLUMN accomplishments.confidence_score IS 'Gemini output confidence 0.0-1.0. Below 0.7 = low_confidence status.';
