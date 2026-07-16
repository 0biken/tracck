-- Tracck Migration 014 — Accomplishment-Role Matches
-- Join table storing per-role relevance scores (doc 04 §4). Scores are
-- role-specific, so they cannot live directly on the accomplishments row —
-- one accomplishment can have different relevance scores for different
-- target roles.

CREATE TABLE IF NOT EXISTS accomplishment_role_matches (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accomplishment_id UUID NOT NULL REFERENCES accomplishments(id) ON DELETE CASCADE,
  target_role_id    UUID NOT NULL REFERENCES target_roles(id) ON DELETE CASCADE,
  relevance_score   DECIMAL(4,3) NOT NULL CHECK (relevance_score BETWEEN 0 AND 1),
  required_skill_overlap       DECIMAL(4,3),
  preferred_skill_overlap      DECIMAL(4,3),
  responsibility_theme_similarity DECIMAL(4,3),
  recency_weight    DECIMAL(4,3),
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accomplishment_role_matches
  ADD CONSTRAINT accomplishment_role_matches_unique UNIQUE (accomplishment_id, target_role_id);

CREATE INDEX IF NOT EXISTS idx_arm_target_role ON accomplishment_role_matches(target_role_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_arm_accomplishment ON accomplishment_role_matches(accomplishment_id);

COMMENT ON TABLE accomplishment_role_matches IS
  'Per-role relevance scores per doc 04 §4 formula. Recomputed whenever a target_role or its underlying accomplishment set changes materially.';
