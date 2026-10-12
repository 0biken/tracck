-- Tracck Migration 005 — Resume Bullets
-- Confirmed, ordered bullets that appear in the generated resume.

CREATE TABLE IF NOT EXISTS resume_bullets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accomplishment_id UUID REFERENCES accomplishments(id) ON DELETE SET NULL,
  bullet_text       TEXT NOT NULL,
  ats_keywords      TEXT[] NOT NULL DEFAULT '{}',
  role_tag          TEXT NOT NULL,
  position          INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE resume_bullets
  ADD CONSTRAINT resume_bullets_role_tag_valid CHECK (
    role_tag IN ('developer', 'devrel', 'smm', 'virtual_assistant', 'ui_designer', 'data_analyst')
  );

CREATE INDEX IF NOT EXISTS idx_resume_bullets_user_id ON resume_bullets(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_bullets_position ON resume_bullets(user_id, position);
CREATE INDEX IF NOT EXISTS idx_resume_bullets_role_tag ON resume_bullets(role_tag);

COMMENT ON TABLE resume_bullets IS 'Decoupled from accomplishments so bullets can be freely edited without affecting source data.';
