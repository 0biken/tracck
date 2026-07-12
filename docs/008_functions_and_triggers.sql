-- Tracck Migration 008 — Functions & Triggers

-- ─── updated_at maintenance ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'connected_accounts', 'accomplishments', 'resume_bullets', 'skills'
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


-- ─── Mirror auth.users → public.users ────────────────────────────────────────

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


-- ─── Notify Railway worker on raw_posts INSERT ───────────────────────────────

CREATE OR REPLACE FUNCTION notify_new_raw_post()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_raw_posts',
    json_build_object(
      'id',       NEW.id,
      'user_id',  NEW.user_id,
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


-- ─── Auto-increment resume version per user ──────────────────────────────────

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


-- ─── Track accomplishment status change timestamp ────────────────────────────

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


-- ─── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_confirmed_bullet_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM resume_bullets WHERE user_id = p_user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_latest_resume(p_user_id UUID)
RETURNS resumes AS $$
  SELECT * FROM resumes WHERE user_id = p_user_id ORDER BY version DESC LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
