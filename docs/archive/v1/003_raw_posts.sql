-- Tracck Migration 003 — Raw Posts
-- Raw social post content fetched from connected platforms.

CREATE TABLE IF NOT EXISTS raw_posts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id       UUID REFERENCES connected_accounts(id) ON DELETE SET NULL,
  platform         TEXT NOT NULL,
  post_id          TEXT NOT NULL,
  content          TEXT NOT NULL,
  raw_data         JSONB DEFAULT '{}',
  posted_at        TIMESTAMPTZ NOT NULL,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed        BOOLEAN NOT NULL DEFAULT FALSE,
  has_signal       BOOLEAN,
  no_signal_reason TEXT
);

ALTER TABLE raw_posts
  ADD CONSTRAINT raw_posts_user_platform_post_unique UNIQUE (user_id, platform, post_id);

CREATE INDEX IF NOT EXISTS idx_raw_posts_user_id ON raw_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_raw_posts_processed ON raw_posts(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_raw_posts_posted_at ON raw_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_posts_platform ON raw_posts(platform);
CREATE INDEX IF NOT EXISTS idx_raw_posts_needs_extraction
  ON raw_posts(user_id, id)
  WHERE processed = FALSE AND has_signal IS NULL;

COMMENT ON COLUMN raw_posts.has_signal IS 'NULL = pending evaluation. TRUE = accomplishment detected. FALSE = no signal.';
COMMENT ON COLUMN raw_posts.raw_data IS 'Full API response payload. Not surfaced to users. For debugging only.';
