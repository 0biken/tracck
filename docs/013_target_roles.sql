-- Tracck Migration 013 — Target Roles
-- New table for role-tailoring (doc 04). A user can have multiple target
-- roles (e.g. tailoring for three different job applications).

CREATE TABLE IF NOT EXISTS target_roles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jd_text               TEXT,
  role_tag              TEXT NOT NULL,
  seniority             TEXT,
  required_skills       TEXT[] NOT NULL DEFAULT '{}',
  preferred_skills      TEXT[] NOT NULL DEFAULT '{}',
  responsibility_themes TEXT[] NOT NULL DEFAULT '{}',
  ats_keywords          TEXT[] NOT NULL DEFAULT '{}',
  parsed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE target_roles
  ADD CONSTRAINT target_roles_role_tag_valid CHECK (
    role_tag IN ('developer', 'devrel', 'smm', 'virtual_assistant', 'ui_designer', 'data_analyst')
  );
  -- Same fixed enum as accomplishments.role_tag (migration 004), so a
  -- pasted-JD role_tag classification stays compatible with existing data.

CREATE INDEX IF NOT EXISTS idx_target_roles_user_id ON target_roles(user_id);

COMMENT ON COLUMN target_roles.jd_text IS
  'Raw pasted job description, if provided. NULL if user selected role_tag directly without a JD (doc 04 §2).';
COMMENT ON COLUMN target_roles.parsed_at IS
  'NULL until the JD parsing job (doc 04 §3) completes. Rows with jd_text set but parsed_at NULL are pending.';
