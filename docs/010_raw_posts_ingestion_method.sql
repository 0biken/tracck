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
