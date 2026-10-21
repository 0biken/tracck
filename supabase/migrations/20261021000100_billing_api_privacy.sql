-- Tracck v2 schema, part 6: tables the PRD data model adds on top of parts 1 to 5.
-- Reference: docs/prd/03-architecture.md "Data model sketch".
--
-- Consents, plans and payments, the organisation API (Phase 3), model-call
-- records and deletion requests. Browser access is read-own on user tables;
-- the organisation API and webhook tables are reachable only by the server.

-- ─── Plan on the profile ─────────────────────────────────────────────────────

alter table public.profiles
  add column primary_role text,
  add column plan         text not null default 'free' check (plan in ('free', 'pro')),
  add column deleted_at   timestamptz;

-- ─── Organisation API clients and keys ───────────────────────────────────────

create table public.api_clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  status     text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_api_clients_updated_at
  before update on public.api_clients
  for each row execute function public.set_updated_at();

create table public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.api_clients(id) on delete cascade,
  prefix      text not null unique,
  -- Only a hash of the secret is stored; the secret is shown once.
  secret_hash text not null,
  mode        text not null default 'live' check (mode in ('test', 'live')),
  scopes      text[] not null default '{}',
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index api_keys_client_idx on public.api_keys (client_id);

create table public.api_usage_events (
  id         uuid primary key default gen_random_uuid(),
  key_id     uuid not null references public.api_keys(id) on delete cascade,
  endpoint   text not null,
  status     integer not null,
  cost_units integer not null default 1,
  at         timestamptz not null default now()
);

create index api_usage_events_key_idx on public.api_usage_events (key_id, at desc);

-- ─── Consents ────────────────────────────────────────────────────────────────

-- A user grants an organisation client access to a scope of their data.
create table public.consents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  client_id  uuid not null references public.api_clients(id) on delete cascade,
  scope      text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index consents_active_unique
  on public.consents (user_id, client_id, scope) where revoked_at is null;
create index consents_client_idx on public.consents (client_id);

-- ─── Billing ─────────────────────────────────────────────────────────────────

create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  provider              text not null,
  provider_customer_id  text,
  provider_subscription_id text,
  plan                  text not null check (plan in ('free', 'pro')),
  status                text not null
    check (status in ('active', 'trialing', 'past_due', 'cancelled', 'expired')),
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id);
create unique index subscriptions_provider_unique
  on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Payment records: reference, amount and time. No card data.
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  subscription_id   uuid references public.subscriptions(id) on delete set null,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  provider          text not null,
  provider_reference text not null,
  amount_minor      bigint not null check (amount_minor >= 0),
  currency          text not null,
  status            text not null check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  unique (provider, provider_reference)
);

create index payments_user_idx on public.payments (user_id, created_at desc);

-- One row per provider event, so a redelivered webhook is applied once.
create table public.webhook_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_event_id text not null,
  event_type        text not null,
  payload_json      jsonb not null default '{}',
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  unique (provider, provider_event_id)
);

create table public.usage_counters (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  metric       text not null,
  period_start date not null,
  count        integer not null default 0 check (count >= 0),
  updated_at   timestamptz not null default now(),
  primary key (user_id, metric, period_start)
);

-- ─── Model calls ─────────────────────────────────────────────────────────────

-- Metadata only. Prompt text is not stored by default. Retained 90 days.
create table public.llm_calls (
  id                uuid primary key default gen_random_uuid(),
  generation_run_id uuid references public.generation_runs(id) on delete cascade,
  user_id           uuid references public.profiles(id) on delete set null,
  role              text not null check (role in ('write', 'check', 'extract', 'embed')),
  provider          text not null,
  model             text not null,
  input_tokens      integer,
  output_tokens     integer,
  cost_estimate     numeric(10,6),
  latency_ms        integer,
  status            text not null check (status in ('ok', 'error', 'timeout', 'refused', 'truncated')),
  created_at        timestamptz not null default now()
);

create index llm_calls_run_idx on public.llm_calls (generation_run_id);
create index llm_calls_created_idx on public.llm_calls (created_at);

-- ─── Deletion ────────────────────────────────────────────────────────────────

create table public.deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  -- Kept after the profile is gone, so completion can be proven.
  user_id      uuid not null,
  status       text not null default 'requested'
    check (status in ('requested', 'in_progress', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  due_at       timestamptz not null default now() + interval '30 days',
  completed_at timestamptz
);

create index deletion_requests_status_idx on public.deletion_requests (status, due_at);

-- ─── Row level security ──────────────────────────────────────────────────────

alter table public.api_clients       enable row level security;
alter table public.api_keys          enable row level security;
alter table public.api_usage_events  enable row level security;
alter table public.consents          enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.payments          enable row level security;
alter table public.webhook_events    enable row level security;
alter table public.usage_counters    enable row level security;
alter table public.llm_calls         enable row level security;
alter table public.deletion_requests enable row level security;

-- No policy on api_*, webhook_events, llm_calls or deletion_requests: server only.
revoke all on public.api_clients, public.api_keys, public.api_usage_events,
  public.webhook_events, public.llm_calls, public.deletion_requests
  from anon, authenticated;

create policy consents_select_own on public.consents
  for select to authenticated using ((select auth.uid()) = user_id);

create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy payments_select_own on public.payments
  for select to authenticated using ((select auth.uid()) = user_id);

create policy usage_counters_select_own on public.usage_counters
  for select to authenticated using ((select auth.uid()) = user_id);
