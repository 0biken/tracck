-- Tracck v2 schema, part 3: target roles, resumes, background jobs, generation runs.
-- Architecture reference: §5.6 to §5.8

create table public.target_opportunities (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  title                text not null,
  company              text,
  job_url              text,
  job_description_text text not null,
  role_family          text,
  seniority            text,
  location             text,
  requirements_json    jsonb not null default '[]',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index target_opportunities_user_idx on public.target_opportunities (user_id, created_at desc);

create trigger trg_target_opportunities_updated_at
  before update on public.target_opportunities
  for each row execute function public.set_updated_at();

-- ─── Background jobs ─────────────────────────────────────────────────────────
-- PostgreSQL is the source of truth for job state. Redis only transports job IDs.

create table public.background_jobs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  job_type            text not null
    check (job_type in ('source_import', 'cv_parse', 'cv_review', 'profile_index',
                        'resume_generation', 'resume_export', 'source_sync', 'cleanup', 'diagnostic')),
  status              text not null default 'queued'
    check (status in ('queued', 'running', 'retry_wait', 'succeeded', 'failed',
                      'cancelled', 'needs_user_action')),
  step                text
    check (step in ('download_source', 'parse_cv', 'normalize', 'embed', 'retrieve', 'draft',
                    'critique', 'revise', 'validate', 'export', 'notify')),
  progress_percent    smallint check (progress_percent between 0 and 100),
  attempt_count       integer not null default 0,
  max_attempts        integer not null default 3 check (max_attempts >= 1),
  idempotency_key     text not null,
  input_ref_json      jsonb not null default '{}',
  result_ref_json     jsonb,
  error_code          text,
  safe_error_message  text,
  correlation_id      text,
  enqueue_error       text,
  -- Bumped on every change. Used as the SSE event ID.
  version             integer not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  started_at          timestamptz,
  heartbeat_at        timestamptz,
  completed_at        timestamptz,
  cancel_requested_at timestamptz,
  unique (user_id, idempotency_key)
);

create index background_jobs_user_idx on public.background_jobs (user_id, created_at desc);
create index background_jobs_open_idx on public.background_jobs (status, updated_at)
  where status in ('queued', 'running', 'retry_wait');

-- ─── Resumes ─────────────────────────────────────────────────────────────────

create table public.resume_documents (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  target_opportunity_id uuid references public.target_opportunities(id) on delete set null,
  title                 text not null,
  status                text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  current_version_id    uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index resume_documents_user_idx on public.resume_documents (user_id, updated_at desc);

create trigger trg_resume_documents_updated_at
  before update on public.resume_documents
  for each row execute function public.set_updated_at();

create table public.generation_runs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  background_job_id        uuid references public.background_jobs(id) on delete set null,
  target_opportunity_id    uuid references public.target_opportunities(id) on delete set null,
  resume_document_id       uuid references public.resume_documents(id) on delete set null,
  status                   text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  model_provider           text,
  model_id                 text,
  stage_models_json        jsonb not null default '{}',
  prompt_version           text,
  rubric_version           text,
  retrieval_config_version text,
  user_focus_json          jsonb not null default '{}',
  tool_calls_json          jsonb not null default '[]',
  retrieved_evidence_ids   uuid[] not null default '{}',
  example_ids              uuid[] not null default '{}',
  metrics_json             jsonb not null default '{}',
  token_usage_json         jsonb not null default '{}',
  cost_estimate            numeric(10,4),
  failure_code             text,
  created_at               timestamptz not null default now(),
  started_at               timestamptz,
  completed_at             timestamptz
);

create index generation_runs_user_idx on public.generation_runs (user_id, created_at desc);

-- Edits and builds add versions. Nothing is overwritten.
create table public.resume_versions (
  id                      uuid primary key default gen_random_uuid(),
  resume_document_id      uuid not null references public.resume_documents(id) on delete cascade,
  version_number          integer not null,
  content_json            jsonb not null,
  plain_text              text,
  layout_key              text not null default 'a4',
  generation_run_id       uuid references public.generation_runs(id) on delete set null,
  created_by              text not null check (created_by in ('ai', 'user', 'import')),
  validation_summary_json jsonb not null default '{}',
  pdf_object_key          text,
  docx_object_key         text,
  export_status           text check (export_status in ('queued', 'ready', 'failed')),
  created_at              timestamptz not null default now(),
  unique (resume_document_id, version_number)
);

alter table public.resume_documents
  add constraint resume_documents_current_version_fk
  foreign key (current_version_id) references public.resume_versions(id) on delete set null;
