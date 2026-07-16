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
