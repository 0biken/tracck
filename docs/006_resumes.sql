-- Tracck Migration 006 — Resumes
-- Generated resume versions with file URLs and ATS scores.

CREATE TABLE IF NOT EXISTS resumes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL DEFAULT 1,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_url         TEXT,
  docx_url        TEXT,
  ats_score       INTEGER CHECK (ats_score BETWEEN 0 AND 100),
  score_breakdown JSONB DEFAULT '{}',
  bullet_count    INTEGER NOT NULL DEFAULT 0,
  summary_text    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE resumes
  ADD CONSTRAINT resumes_user_version_unique UNIQUE (user_id, version);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_generated_at ON resumes(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_version ON resumes(user_id, version DESC);

COMMENT ON COLUMN resumes.pdf_url IS 'Supabase Storage object path. Sign with 1hr TTL at request time — never store public URL.';
COMMENT ON COLUMN resumes.score_breakdown IS 'JSON: {keyword_density, action_verb_usage, quantification_rate, formatting_compliance, section_completeness}';
