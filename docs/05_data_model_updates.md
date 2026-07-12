# Tracck — Data Model Updates

**Version:** 1.0
**Depends on:** `02_ingestion_method_matrix.md`, `03_claim_extraction_spec.md`, `04_role_tailoring_spec.md`
**Format:** Numbered migrations continuing from the existing `docs/00X_*.sql` sequence (current highest is `009_rls_policies.sql`). These are additive — no existing column is renamed or dropped.

---

## Migration 010 — raw_posts: ingestion method

```sql
-- Tracck Migration 010 — Raw Posts: Ingestion Method
-- Tracks how content arrived, per Ingestion Method Matrix (doc 02).
-- Needed because source trustworthiness affects confidence scoring (doc 03 §4).

ALTER TABLE raw_posts
  ADD COLUMN source_method TEXT NOT NULL DEFAULT 'oauth';

ALTER TABLE raw_posts
  ADD CONSTRAINT raw_posts_source_method_valid CHECK (
    source_method IN ('oauth', 'manual_paste', 'file_upload')
  );

-- Pasted content has no API-native timestamp; user supplies approximate date.
ALTER TABLE raw_posts
  ADD COLUMN posted_at_is_approximate BOOLEAN NOT NULL DEFAULT FALSE;

-- Attestation checkbox from Ingestion Method Matrix §5 step 3.
ALTER TABLE raw_posts
  ADD COLUMN ownership_attested BOOLEAN NOT NULL DEFAULT TRUE;
  -- Default TRUE preserves existing OAuth rows' semantics (ownership guaranteed
  -- by the OAuth grant itself). New manual_paste rows must explicitly set this
  -- based on the attestation checkbox at submission time.

CREATE INDEX IF NOT EXISTS idx_raw_posts_source_method ON raw_posts(source_method);

COMMENT ON COLUMN raw_posts.source_method IS
  'oauth = pulled via authenticated API. manual_paste = user pasted text directly. file_upload = parsed from an uploaded export (e.g. LinkedIn data export).';
COMMENT ON COLUMN raw_posts.ownership_attested IS
  'TRUE for all oauth rows (implicit via OAuth grant). For manual_paste/file_upload, TRUE only if user checked the ownership attestation box at submission.';
```

---

## Migration 011 — raw_posts: platform enum extension

```sql
-- Tracck Migration 011 — Raw Posts: Platform Enum Extension
-- connected_accounts already allows 'behance' and 'instagram' (migration 002).
-- raw_posts.platform has no explicit CHECK constraint currently, but this
-- migration adds one for consistency and to formally add 'facebook'.

ALTER TABLE raw_posts
  ADD CONSTRAINT raw_posts_platform_valid CHECK (
    platform IN ('github', 'twitter', 'linkedin', 'figma', 'behance', 'instagram', 'facebook')
  );
```

---

## Migration 012 — accomplishments: claim taxonomy and confidence breakdown

```sql
-- Tracck Migration 012 — Accomplishments: Claim Taxonomy
-- Adds the classification fields from Claim Extraction Spec (doc 03).

ALTER TABLE accomplishments
  ADD COLUMN claim_category TEXT NOT NULL DEFAULT 'direct_achievement';

ALTER TABLE accomplishments
  ADD CONSTRAINT accomplishments_claim_category_valid CHECK (
    claim_category IN ('direct_achievement', 'participation_claim')
    -- Note: only categories that pass Stage 1 and reach bullet generation
    -- are ever written here. 'future_or_aspirational', 'third_party_share',
    -- 'sentiment_only', and 'ambiguous' are discarded upstream (doc 03 §2, §6)
    -- and never produce an accomplishments row.
  );

-- Split the single confidence_score into its two contributing factors,
-- per doc 03 §4's scoring formula. Keep confidence_score as the final
-- computed value (existing column, unchanged meaning) and add the inputs
-- alongside it for debuggability.
ALTER TABLE accomplishments
  ADD COLUMN model_confidence DECIMAL(4,3) CHECK (model_confidence BETWEEN 0 AND 1);

ALTER TABLE accomplishments
  ADD COLUMN source_trust_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0;

COMMENT ON COLUMN accomplishments.confidence_score IS
  'Final confidence = model_confidence × source_trust_multiplier. Below 0.7 = low_confidence status (existing). Below 0.5 = not written to this table at all (doc 03 §4).';
COMMENT ON COLUMN accomplishments.model_confidence IS
  'Raw Stage 1 classifier confidence, before source trust adjustment.';
COMMENT ON COLUMN accomplishments.source_trust_multiplier IS
  'oauth=1.0, manual_paste=0.85, file_upload=0.90. Copied from raw_posts.source_method at extraction time (doc 03 §4).';
```

---

## Migration 013 — target_roles table

```sql
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
```

---

## Migration 014 — accomplishment_role_matches table

```sql
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
```

---

## Migration 015 — resumes: optional target_role linkage

```sql
-- Tracck Migration 015 — Resumes: Target Role Linkage
-- Extends the existing resumes table (migration 006) so a generated resume
-- can optionally record which target role it was tailored for.

ALTER TABLE resumes
  ADD COLUMN target_role_id UUID REFERENCES target_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resumes_target_role ON resumes(target_role_id) WHERE target_role_id IS NOT NULL;

COMMENT ON COLUMN resumes.target_role_id IS
  'NULL for generic (non-tailored) resumes. Set when generated via POST /api/roles/:role_id/resume (doc 04 §7).';
```

---

## RLS policy additions (extends migration 009)

```sql
-- target_roles: users can only see/manage their own
ALTER TABLE target_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY target_roles_select_own ON target_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY target_roles_insert_own ON target_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY target_roles_delete_own ON target_roles
  FOR DELETE USING (auth.uid() = user_id);

-- accomplishment_role_matches: readable if the user owns the underlying
-- accomplishment. No direct insert/update policy for authenticated users —
-- this table is written only by the worker's service-role connection,
-- matching the pattern established for accomplishments in migration 009.
ALTER TABLE accomplishment_role_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY arm_select_own ON accomplishment_role_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM accomplishments a
      WHERE a.id = accomplishment_role_matches.accomplishment_id
      AND a.user_id = auth.uid()
    )
  );
```

---

## Summary of net-new tables vs. extended tables

| Table | Status | Migration |
|---|---|---|
| `raw_posts` | Extended | 010, 011 |
| `accomplishments` | Extended | 012 |
| `target_roles` | New | 013 |
| `accomplishment_role_matches` | New | 014 |
| `resumes` | Extended | 015 |
