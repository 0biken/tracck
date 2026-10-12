-- Tracck Migration 007 — Skills
-- User skills extracted from GitHub, AI analysis, or entered manually.

CREATE TABLE IF NOT EXISTS skills (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_name  TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'manual',
  proficiency TEXT NOT NULL DEFAULT 'intermediate',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE skills
  ADD CONSTRAINT skills_source_valid CHECK (
    source IN ('github', 'manual', 'ai_extracted')
  );

ALTER TABLE skills
  ADD CONSTRAINT skills_proficiency_valid CHECK (
    proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')
  );

ALTER TABLE skills
  ADD CONSTRAINT skills_user_name_unique UNIQUE (user_id, skill_name);

CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);
