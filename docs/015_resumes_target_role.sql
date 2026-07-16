-- Tracck Migration 015 — Resumes: Target Role Linkage
-- Extends the existing resumes table (migration 006) so a generated resume
-- can optionally record which target role it was tailored for.

ALTER TABLE resumes
  ADD COLUMN target_role_id UUID REFERENCES target_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resumes_target_role ON resumes(target_role_id) WHERE target_role_id IS NOT NULL;

COMMENT ON COLUMN resumes.target_role_id IS
  'NULL for generic (non-tailored) resumes. Set when generated via POST /api/roles/:role_id/resume (doc 04 §7).';
