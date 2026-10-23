-- Custom migration: what the schema file cannot express.
-- pgvector lives in Supabase's `extensions` schema; later migrations use its types and
-- operators, so it is on the search path for the rest of this migration run.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;--> statement-breakpoint
SET LOCAL search_path TO public, extensions;--> statement-breakpoint
CREATE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
