-- Tracck Migration 001 — Users
-- Run first. Core identity table.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role_tags     TEXT[] NOT NULL DEFAULT '{}',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD CONSTRAINT users_role_tags_valid CHECK (
    role_tags <@ ARRAY[
      'developer', 'devrel', 'smm',
      'virtual_assistant', 'ui_designer', 'data_analyst'
    ]::TEXT[]
  );

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

COMMENT ON TABLE users IS 'Core user identity. Mirrors Supabase auth.users via trigger.';
COMMENT ON COLUMN users.role_tags IS 'Array of role category tags used to prime AI classification.';
