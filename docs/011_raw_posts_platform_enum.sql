-- Tracck Migration 011 — Raw Posts: Platform Enum Extension
-- connected_accounts already allows 'behance' and 'instagram' (migration 002).
-- raw_posts.platform has no explicit CHECK constraint currently, but this
-- migration adds one for consistency and to formally add 'facebook'.

ALTER TABLE raw_posts
  ADD CONSTRAINT raw_posts_platform_valid CHECK (
    source_platform IN ('github', 'twitter', 'linkedin', 'figma', 'behance', 'instagram', 'facebook', 'portfolio_url', 'unknown')
  );
