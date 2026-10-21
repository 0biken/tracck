-- Tracck v2 schema, part 8: what the product API needs on top of parts 1 to 7.
--
-- Evidence controls (pin, exclude, edit), resume details, CV reviews, consent
-- requests from organisations, student verification, policy consents, API key
-- management fields, and the extra job types. Browser access stays read-own;
-- everything new is written by the API with the server-only role.

-- ─── Job types and source types ──────────────────────────────────────────────

alter table public.background_jobs drop constraint background_jobs_job_type_check;
alter table public.background_jobs add constraint background_jobs_job_type_check
  check (job_type in ('source_import', 'cv_parse', 'cv_review', 'profile_index',
                      'resume_generation', 'resume_export', 'source_sync', 'cleanup', 'diagnostic',
                      'data_export', 'account_deletion', 'email_send', 'webhook_delivery', 'weekly_digest'));

alter table public.source_items drop constraint source_items_source_type_check;
alter table public.source_items add constraint source_items_source_type_check
  check (source_type in ('github_repo', 'github_contribution', 'social_post', 'portfolio_page',
                         'uploaded_cv', 'manual_experience', 'job_description', 'data_export',
                         'linkedin_profile', 'pasted_text'));

-- ─── Profile ─────────────────────────────────────────────────────────────────

alter table public.profiles
  add column student_email            text,
  add column student_verified_at      timestamptz,
  add column onboarding_completed_at  timestamptz;

-- Student Plus is the Pro plan at a student price, not a separate plan.
alter table public.subscriptions
  add column price_tier           text not null default 'standard' check (price_tier in ('standard', 'student')),
  add column provider_email_token text;

-- Which version of which policy a person agreed to, per purpose.
create table public.user_policy_consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  purpose      text not null check (purpose in ('terms', 'privacy', 'ai_processing')),
  text_version text not null,
  granted_at   timestamptz not null default now(),
  unique (user_id, purpose, text_version)
);

create table public.student_verifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  email      text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index student_verifications_user_idx on public.student_verifications (user_id, created_at desc);

-- ─── Evidence controls ───────────────────────────────────────────────────────

alter table public.candidate_evidence
  add column title         text,
  add column pinned        boolean not null default false,
  add column excluded      boolean not null default false,
  add column user_edited   boolean not null default false,
  -- The wording the entry was first made with, kept when the person rewords it.
  add column original_text text,
  add column project_key   text,
  -- Where it came from, kept on the row so lists and counts need no joins.
  add column source_provider text,
  add column source_where    text,
  add column skills        text[] not null default '{}',
  -- Bumped on every change, so a stale edit can be refused.
  add column version       integer not null default 1;

create index candidate_evidence_project_idx on public.candidate_evidence (user_id, project_key);
create index candidate_evidence_flags_idx on public.candidate_evidence (user_id) where pinned or excluded;

alter table public.evidence_relations drop constraint evidence_relations_relation_type_check;
alter table public.evidence_relations add constraint evidence_relations_relation_type_check
  check (relation_type in ('demonstrates_skill', 'belongs_to_project', 'contributed_to_outcome',
                           'used_technology', 'supports_role_requirement', 'derived_from', 'contradicts',
                           'possible_duplicate'));

-- ─── CV reviews ──────────────────────────────────────────────────────────────

create table public.cv_reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  source_item_id uuid references public.source_items(id) on delete set null,
  role_family    text,
  result_json    jsonb not null,
  engine         text not null default 'placeholder',
  created_at     timestamptz not null default now()
);

create index cv_reviews_user_idx on public.cv_reviews (user_id, created_at desc);

-- ─── Resumes ─────────────────────────────────────────────────────────────────

alter table public.resume_documents drop constraint resume_documents_status_check;
alter table public.resume_documents add constraint resume_documents_status_check
  check (status in ('generating', 'draft', 'ready', 'failed', 'archived'));

alter table public.resume_documents
  add column company           text,
  add column length            text not null default 'one_page' check (length in ('one_page', 'full')),
  add column role_id           text,
  add column source_selection  text[] not null default '{}',
  add column focus             text,
  add column engine            text not null default 'placeholder',
  add column last_exported_at  timestamptz;

-- ─── Organisation API ────────────────────────────────────────────────────────

alter table public.api_clients
  add column contact_email     text,
  add column monthly_quota     integer not null default 5000,
  add column webhook_url       text,
  -- Encrypted by the API; used to sign webhook deliveries.
  add column webhook_secret_encrypted text;

alter table public.api_keys
  add column label              text not null default 'Key',
  add column rate_limit_per_min integer not null default 60 check (rate_limit_per_min > 0),
  add column monthly_quota      integer,
  add column last_used_at       timestamptz,
  add column last_used_ip       text,
  -- A rotated key keeps working until this time.
  add column stops_at           timestamptz,
  add column rotated_from       uuid references public.api_keys(id) on delete set null,
  add column created_by         uuid references public.profiles(id) on delete set null;

alter table public.api_usage_events
  add column ip text;

-- An organisation asks a person for access; the person decides on a Tracck page.
create table public.consent_requests (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.api_clients(id) on delete cascade,
  token_hash  text not null unique,
  scopes      text[] not null,
  -- The organisation's own reference for the person, echoed back to them.
  external_ref text,
  status      text not null default 'pending' check (status in ('pending', 'granted', 'denied', 'expired')),
  user_id     uuid references public.profiles(id) on delete set null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

create index consent_requests_client_idx on public.consent_requests (client_id, created_at desc);

alter table public.audit_events
  add column client_id uuid references public.api_clients(id) on delete set null,
  add column key_id    uuid references public.api_keys(id) on delete set null,
  -- Who did it: a staff member's ID, a user, or "api".
  add column actor     text,
  add column ip        text;

create index audit_events_client_idx on public.audit_events (client_id, created_at desc);

-- ─── Row level security ──────────────────────────────────────────────────────

alter table public.user_policy_consents enable row level security;
alter table public.student_verifications enable row level security;
alter table public.cv_reviews            enable row level security;
alter table public.consent_requests      enable row level security;

revoke all on public.student_verifications, public.consent_requests from anon, authenticated;

create policy user_policy_consents_select_own on public.user_policy_consents
  for select to authenticated using ((select auth.uid()) = user_id);

create policy cv_reviews_select_own on public.cv_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
