# Tracck — Database Migration Files

**Version:** 1.0  
**Database:** Supabase (PostgreSQL 15)  
**Run order:** Execute migrations in numbered order. Each is idempotent.

---

## Running Migrations

```bash
# Via Supabase CLI (recommended)
supabase migration new <name>
supabase db push

# Or directly via psql
psql $DATABASE_URL -f migrations/001_users.sql
```

---

## Migration Index

| File | Description |
|------|-------------|
| `001_users.sql` | Core user table |
| `002_connected_accounts.sql` | OAuth tokens per platform |
| `003_raw_posts.sql` | Fetched social post content |
| `004_accomplishments.sql` | AI-extracted accomplishments |
| `005_resume_bullets.sql` | Confirmed resume bullets |
| `006_resumes.sql` | Generated resume versions |
| `007_skills.sql` | User skills |
| `008_functions_and_triggers.sql` | DB functions + automation triggers |
| `009_rls_policies.sql` | Row Level Security policies |

---

## 001 — Users

```sql
-- migrations/001_users.sql

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

-- role_tags must be subset of valid values
ALTER TABLE users
  ADD CONSTRAINT users_role_tags_valid CHECK (
    role_tags <@ ARRAY[
      'developer',
      'devrel',
      'smm',
      'virtual_assistant',
      'ui_designer',
      'data_analyst'
    ]::TEXT[]
  );

-- Updated_at auto-maintained by trigger (see 008)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

COMMENT ON TABLE users IS 'Core user identity. Mirrors Supabase auth.users via trigger.';
COMMENT ON COLUMN users.role_tags IS 'Array of role category tags used to prime AI classification.';
```

---

## 002 — Connected Accounts

```sql
-- migrations/002_connected_accounts.sql

CREATE TABLE IF NOT EXISTS connected_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  username        TEXT NOT NULL,
  access_token    TEXT,                  -- AES-256-GCM encrypted in application layer
  refresh_token   TEXT,                  -- AES-256-GCM encrypted
  token_expires_at TIMESTAMPTZ,
  scopes          TEXT[] DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active',
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE connected_accounts
  ADD CONSTRAINT connected_accounts_platform_valid CHECK (
    platform IN ('github', 'twitter', 'linkedin', 'figma', 'behance', 'instagram')
  );

ALTER TABLE connected_accounts
  ADD CONSTRAINT connected_accounts_status_valid CHECK (
    status IN ('active', 'token_expired', 'error', 'disconnected')
  );

-- One account per platform per user
ALTER TABLE connected_accounts
  ADD CONSTRAINT connected_accounts_user_platform_unique UNIQUE (user_id, platform);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id ON connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_status ON connected_accounts(status);

COMMENT ON COLUMN connected_accounts.access_token
  IS 'Encrypted at rest using AES-256-GCM in the application layer before storage.';
```

---

## 003 — Raw Posts

```sql
-- migrations/003_raw_posts.sql

CREATE TABLE IF NOT EXISTS raw_posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES connected_accounts(id) ON DELETE SET NULL,
  platform        TEXT NOT NULL,
  post_id         TEXT NOT NULL,              -- Platform-native post identifier
  content         TEXT NOT NULL,
  raw_data        JSONB DEFAULT '{}',         -- Full raw API response for debugging
  posted_at       TIMESTAMPTZ NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed       BOOLEAN NOT NULL DEFAULT FALSE,
  has_signal      BOOLEAN,                    -- NULL = not yet evaluated
  no_signal_reason TEXT                       -- 'casual', 'retweet', 'opinion', etc.
);

-- Prevent duplicate posts per user per platform
ALTER TABLE raw_posts
  ADD CONSTRAINT raw_posts_user_platform_post_unique UNIQUE (user_id, platform, post_id);

CREATE INDEX IF NOT EXISTS idx_raw_posts_user_id ON raw_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_raw_posts_processed ON raw_posts(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_raw_posts_posted_at ON raw_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_posts_platform ON raw_posts(platform);

-- Partial index for AI extraction queue — only unprocessed posts with signal
CREATE INDEX IF NOT EXISTS idx_raw_posts_needs_extraction
  ON raw_posts(user_id, id)
  WHERE processed = FALSE AND has_signal IS NULL;

COMMENT ON COLUMN raw_posts.raw_data IS 'Full API response payload kept for debugging. Not surfaced to users.';
COMMENT ON COLUMN raw_posts.has_signal IS 'NULL = pending evaluation. TRUE = accomplishment detected. FALSE = no signal.';
```

---

## 004 — Accomplishments

```sql
-- migrations/004_accomplishments.sql

CREATE TABLE IF NOT EXISTS accomplishments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_post_id       UUID REFERENCES raw_posts(id) ON DELETE SET NULL,
  extracted_text    TEXT NOT NULL,             -- Cleaned source text used for extraction
  bullet_text       TEXT NOT NULL,             -- AI-generated resume bullet (editable)
  role_tag          TEXT NOT NULL,
  ats_keywords      TEXT[] NOT NULL DEFAULT '{}',
  metric_flag       BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_score  DECIMAL(4,3) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  status            TEXT NOT NULL DEFAULT 'pending',
  status_changed_at TIMESTAMPTZ,
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accomplishments
  ADD CONSTRAINT accomplishments_role_tag_valid CHECK (
    role_tag IN ('developer', 'devrel', 'smm', 'virtual_assistant', 'ui_designer', 'data_analyst')
  );

ALTER TABLE accomplishments
  ADD CONSTRAINT accomplishments_status_valid CHECK (
    status IN ('pending', 'confirmed', 'dismissed', 'low_confidence')
  );

CREATE INDEX IF NOT EXISTS idx_accomplishments_user_id ON accomplishments(user_id);
CREATE INDEX IF NOT EXISTS idx_accomplishments_status ON accomplishments(status);
CREATE INDEX IF NOT EXISTS idx_accomplishments_user_status ON accomplishments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_accomplishments_role_tag ON accomplishments(role_tag);
CREATE INDEX IF NOT EXISTS idx_accomplishments_detected_at ON accomplishments(detected_at DESC);

COMMENT ON COLUMN accomplishments.metric_flag IS 'TRUE = bullet contains or should contain a quantifiable metric. User prompted to confirm/add number.';
COMMENT ON COLUMN accomplishments.confidence_score IS 'Gemini confidence score 0.0-1.0. Below 0.7 → low_confidence status.';
```

---

## 005 — Resume Bullets

```sql
-- migrations/005_resume_bullets.sql

CREATE TABLE IF NOT EXISTS resume_bullets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accomplishment_id UUID REFERENCES accomplishments(id) ON DELETE SET NULL,
  bullet_text       TEXT NOT NULL,
  ats_keywords      TEXT[] NOT NULL DEFAULT '{}',
  role_tag          TEXT NOT NULL,
  position          INTEGER NOT NULL DEFAULT 0,  -- Display order in resume
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE resume_bullets
  ADD CONSTRAINT resume_bullets_role_tag_valid CHECK (
    role_tag IN ('developer', 'devrel', 'smm', 'virtual_assistant', 'ui_designer', 'data_analyst')
  );

CREATE INDEX IF NOT EXISTS idx_resume_bullets_user_id ON resume_bullets(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_bullets_position ON resume_bullets(user_id, position);
CREATE INDEX IF NOT EXISTS idx_resume_bullets_role_tag ON resume_bullets(role_tag);

COMMENT ON TABLE resume_bullets IS 'Confirmed, ordered bullets that appear in the generated resume. Decoupled from accomplishments so bullets can be edited freely without affecting source data.';
```

---

## 006 — Resumes

```sql
-- migrations/006_resumes.sql

CREATE TABLE IF NOT EXISTS resumes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL DEFAULT 1,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_url         TEXT,           -- Supabase Storage path (not public URL)
  docx_url        TEXT,           -- Supabase Storage path
  ats_score       INTEGER CHECK (ats_score BETWEEN 0 AND 100),
  score_breakdown JSONB DEFAULT '{}',  -- Per-dimension scores
  bullet_count    INTEGER NOT NULL DEFAULT 0,
  summary_text    TEXT,           -- AI-generated summary used in this version
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- score_breakdown shape:
-- {
--   "keyword_density": 28,
--   "action_verb_usage": 18,
--   "quantification_rate": 16,
--   "formatting_compliance": 15,
--   "section_completeness": 13
-- }

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_generated_at ON resumes(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_version ON resumes(user_id, version DESC);

-- Unique version per user
ALTER TABLE resumes
  ADD CONSTRAINT resumes_user_version_unique UNIQUE (user_id, version);

COMMENT ON COLUMN resumes.pdf_url IS 'Supabase Storage object path, not a signed URL. Sign at request time with 1hr TTL.';
COMMENT ON COLUMN resumes.score_breakdown IS 'JSON breakdown of the 5 ATS scoring dimensions.';
```

---

## 007 — Skills

```sql
-- migrations/007_skills.sql

CREATE TABLE IF NOT EXISTS skills (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_name      TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual',
  proficiency     TEXT NOT NULL DEFAULT 'intermediate',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE skills
  ADD CONSTRAINT skills_source_valid CHECK (
    source IN ('github', 'manual', 'ai_extracted')
  );

ALTER TABLE skills
  ADD CONSTRAINT skills_proficiency_valid CHECK (
    proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')
  );

-- No duplicate skills per user
ALTER TABLE skills
  ADD CONSTRAINT skills_user_name_unique UNIQUE (user_id, skill_name);

CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);

COMMENT ON COLUMN skills.source IS 'github = auto-detected from repo languages. manual = user-entered. ai_extracted = detected from posts.';
```

---

## 008 — Functions & Triggers

```sql
-- migrations/008_functions_and_triggers.sql

-- ─── updated_at auto-maintenance ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users',
    'connected_accounts',
    'accomplishments',
    'resume_bullets',
    'skills'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
       CREATE TRIGGER trg_%I_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;


-- ─── Mirror Supabase auth.users → public.users ──────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();


-- ─── Auto-enqueue ai-extraction on raw_posts INSERT ─────────────────────────
-- Notifies the Railway worker via pg_notify instead of HTTP call
-- Railway worker listens on the 'new_raw_posts' channel

CREATE OR REPLACE FUNCTION notify_new_raw_post()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_raw_posts',
    json_build_object(
      'id',      NEW.id,
      'user_id', NEW.user_id,
      'platform', NEW.platform
    )::TEXT
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_raw_posts_notify ON raw_posts;
CREATE TRIGGER trg_raw_posts_notify
  AFTER INSERT ON raw_posts
  FOR EACH ROW EXECUTE FUNCTION notify_new_raw_post();


-- ─── Auto-increment resume version ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_resume_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1
    INTO next_version
    FROM resumes
   WHERE user_id = NEW.user_id;

  NEW.version = next_version;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resumes_version ON resumes;
CREATE TRIGGER trg_resumes_version
  BEFORE INSERT ON resumes
  FOR EACH ROW EXECUTE FUNCTION set_resume_version();


-- ─── Track accomplishment status change time ─────────────────────────────────

CREATE OR REPLACE FUNCTION track_accomplishment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accomplishments_status_changed ON accomplishments;
CREATE TRIGGER trg_accomplishments_status_changed
  BEFORE UPDATE ON accomplishments
  FOR EACH ROW EXECUTE FUNCTION track_accomplishment_status_change();


-- ─── Helper: count confirmed bullets per user ────────────────────────────────

CREATE OR REPLACE FUNCTION get_confirmed_bullet_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
    FROM resume_bullets
   WHERE user_id = p_user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;


-- ─── Helper: get latest resume for user ──────────────────────────────────────

CREATE OR REPLACE FUNCTION get_latest_resume(p_user_id UUID)
RETURNS resumes AS $$
  SELECT *
    FROM resumes
   WHERE user_id = p_user_id
   ORDER BY version DESC
   LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

---

## 009 — Row Level Security Policies

```sql
-- migrations/009_rls_policies.sql

-- Enable RLS on all user-data tables
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE accomplishments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_bullets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills              ENABLE ROW LEVEL SECURITY;


-- ─── users ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = id);


-- ─── connected_accounts ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS connected_accounts_all_own ON connected_accounts;
CREATE POLICY connected_accounts_all_own ON connected_accounts
  FOR ALL USING (auth.uid() = user_id);


-- ─── raw_posts ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS raw_posts_select_own ON raw_posts;
CREATE POLICY raw_posts_select_own ON raw_posts
  FOR SELECT USING (auth.uid() = user_id);

-- Workers use service role key — bypasses RLS intentionally
-- No INSERT/UPDATE policy for authenticated role (workers use service role)


-- ─── accomplishments ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS accomplishments_select_own ON accomplishments;
CREATE POLICY accomplishments_select_own ON accomplishments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS accomplishments_update_own ON accomplishments;
CREATE POLICY accomplishments_update_own ON accomplishments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── resume_bullets ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS resume_bullets_all_own ON resume_bullets;
CREATE POLICY resume_bullets_all_own ON resume_bullets
  FOR ALL USING (auth.uid() = user_id);


-- ─── resumes ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS resumes_select_own ON resumes;
CREATE POLICY resumes_select_own ON resumes
  FOR SELECT USING (auth.uid() = user_id);


-- ─── skills ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS skills_all_own ON skills;
CREATE POLICY skills_all_own ON skills
  FOR ALL USING (auth.uid() = user_id);


-- ─── Notes ───────────────────────────────────────────────────────────────────
-- Workers (BullMQ on Railway) use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- This is intentional: workers need cross-user access for CRON jobs.
-- Service role key must NEVER be exposed client-side or in browser code.
```

---

## Schema Diagram

```
users
  ├── id (PK)
  ├── email
  ├── name
  ├── role_tags[]
  └── avatar_url

connected_accounts
  ├── id (PK)
  ├── user_id → users.id
  ├── platform
  ├── username
  ├── access_token (encrypted)
  ├── refresh_token (encrypted)
  └── status

raw_posts
  ├── id (PK)
  ├── user_id → users.id
  ├── account_id → connected_accounts.id
  ├── platform
  ├── post_id (platform-native)
  ├── content
  ├── processed
  └── has_signal

accomplishments
  ├── id (PK)
  ├── user_id → users.id
  ├── raw_post_id → raw_posts.id
  ├── bullet_text
  ├── role_tag
  ├── ats_keywords[]
  ├── confidence_score
  └── status (pending/confirmed/dismissed/low_confidence)

resume_bullets
  ├── id (PK)
  ├── user_id → users.id
  ├── accomplishment_id → accomplishments.id
  ├── bullet_text (editable copy)
  ├── role_tag
  └── position

resumes
  ├── id (PK)
  ├── user_id → users.id
  ├── version
  ├── pdf_url
  ├── docx_url
  ├── ats_score
  └── score_breakdown (JSONB)

skills
  ├── id (PK)
  ├── user_id → users.id
  ├── skill_name
  ├── source (github/manual/ai_extracted)
  └── proficiency
```
