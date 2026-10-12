-- Tracck Migration 002 — Connected Accounts
-- Stores OAuth tokens per social platform per user.

CREATE TABLE IF NOT EXISTS connected_accounts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL,
  username         TEXT NOT NULL,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes           TEXT[] DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'active',
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE connected_accounts
  ADD CONSTRAINT connected_accounts_platform_valid CHECK (
    platform IN ('github', 'twitter', 'linkedin', 'figma', 'behance', 'instagram')
  );

ALTER TABLE connected_accounts
  ADD CONSTRAINT connected_accounts_status_valid CHECK (
    status IN ('active', 'token_expired', 'error', 'disconnected')
  );

ALTER TABLE connected_accounts
  ADD CONSTRAINT connected_accounts_user_platform_unique UNIQUE (user_id, platform);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id ON connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_status ON connected_accounts(status);

COMMENT ON COLUMN connected_accounts.access_token
  IS 'AES-256-GCM encrypted in application layer before storage. Never store plaintext.';
