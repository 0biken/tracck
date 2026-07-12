-- Tracck Migration 009 — Row Level Security Policies
-- Run last. Locks down all tables to owner-only access.
-- Workers use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS by design.

ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE accomplishments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_bullets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills              ENABLE ROW LEVEL SECURITY;

-- users
DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = id);

-- connected_accounts
DROP POLICY IF EXISTS connected_accounts_all_own ON connected_accounts;
CREATE POLICY connected_accounts_all_own ON connected_accounts
  FOR ALL USING (auth.uid() = user_id);

-- raw_posts (read-only for users; workers write via service role)
DROP POLICY IF EXISTS raw_posts_select_own ON raw_posts;
CREATE POLICY raw_posts_select_own ON raw_posts FOR SELECT USING (auth.uid() = user_id);

-- accomplishments
DROP POLICY IF EXISTS accomplishments_select_own ON accomplishments;
CREATE POLICY accomplishments_select_own ON accomplishments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS accomplishments_update_own ON accomplishments;
CREATE POLICY accomplishments_update_own ON accomplishments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- resume_bullets
DROP POLICY IF EXISTS resume_bullets_all_own ON resume_bullets;
CREATE POLICY resume_bullets_all_own ON resume_bullets
  FOR ALL USING (auth.uid() = user_id);

-- resumes (read-only for users; workers write via service role)
DROP POLICY IF EXISTS resumes_select_own ON resumes;
CREATE POLICY resumes_select_own ON resumes FOR SELECT USING (auth.uid() = user_id);

-- skills
DROP POLICY IF EXISTS skills_all_own ON skills;
CREATE POLICY skills_all_own ON skills FOR ALL USING (auth.uid() = user_id);
