-- Tracck v2 schema, part 4: role examples and rubrics, notifications, audit events.
-- Architecture reference: §5.9, §5.10

create table public.resume_examples (
  id                   uuid primary key default gen_random_uuid(),
  role_family          text not null,
  seniority            text not null,
  locale               text not null default 'en',
  layout_key           text not null default 'a4',
  example_kind         text not null check (example_kind in ('good', 'annotated_bad')),
  example_content_json jsonb not null,
  annotations_json     jsonb not null default '[]',
  quality_notes        text,
  rights_status        text not null check (rights_status in ('owned', 'licensed', 'synthetic')),
  active               boolean not null default true,
  version              integer not null default 1,
  created_at           timestamptz not null default now()
);

create index resume_examples_lookup_idx
  on public.resume_examples (role_family, seniority, example_kind) where active;

create table public.role_rubrics (
  id                uuid primary key default gen_random_uuid(),
  role_family       text not null,
  seniority         text not null,
  version           integer not null,
  criteria_json     jsonb not null,
  weights_json      jsonb not null,
  tone_profile_json jsonb not null default '{}',
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (role_family, seniority, version)
);

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  job_id          uuid references public.background_jobs(id) on delete set null,
  channel         text not null check (channel in ('in_app', 'email')),
  template        text not null,
  payload_json    jsonb not null default '{}',
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed', 'skipped')),
  -- One send per event and channel, however many times the job is delivered.
  idempotency_key text not null,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  read_at         timestamptz,
  unique (user_id, idempotency_key)
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Security-relevant actions. Never store document contents here.
create table public.audit_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete set null,
  event_type     text not null,
  subject_type   text,
  subject_id     uuid,
  correlation_id text,
  metadata_json  jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index audit_events_user_idx on public.audit_events (user_id, created_at desc);
