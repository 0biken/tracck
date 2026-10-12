-- Tracck v2 schema, part 2: source connections, source items, candidate evidence.
-- Architecture reference: §5.2 to §5.5

-- ─── Source connections ──────────────────────────────────────────────────────

create table public.source_connections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  provider            text not null,
  provider_account_id text,
  display_handle      text,
  status              text not null default 'connected'
    check (status in ('not_connected', 'connected', 'sync_queued', 'syncing',
                      'synced', 'partial', 'needs_reauth', 'error')),
  granted_scopes      text[] not null default '{}',
  consent_version     text not null,
  connected_at        timestamptz not null default now(),
  last_sync_at        timestamptz,
  last_error_code     text,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index source_connections_account_unique
  on public.source_connections (user_id, provider, provider_account_id)
  where revoked_at is null;
create index source_connections_user_idx on public.source_connections (user_id);

create trigger trg_source_connections_updated_at
  before update on public.source_connections
  for each row execute function public.set_updated_at();

-- Provider tokens live in their own table so no browser-facing policy can ever
-- select them. Values are encrypted by the API before they are stored.
create table public.source_connection_secrets (
  connection_id           uuid primary key references public.source_connections(id) on delete cascade,
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expires_at        timestamptz,
  key_version             text not null,
  updated_at              timestamptz not null default now()
);

create trigger trg_source_connection_secrets_updated_at
  before update on public.source_connection_secrets
  for each row execute function public.set_updated_at();

-- ─── Source items ────────────────────────────────────────────────────────────

create table public.source_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  connection_id     uuid references public.source_connections(id) on delete set null,
  source_type       text not null
    check (source_type in ('github_repo', 'github_contribution', 'social_post', 'portfolio_page',
                           'uploaded_cv', 'manual_experience', 'job_description', 'data_export')),
  provider_item_id  text,
  canonical_url     text,
  title             text,
  body_text         text,
  source_created_at timestamptz,
  imported_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  content_hash      text,
  raw_object_key    text,
  permissions_json  jsonb not null default '{}',
  metadata_json     jsonb not null default '{}',
  deletion_status   text not null default 'active'
    check (deletion_status in ('active', 'pending_deletion', 'deleted'))
);

-- Repeat imports update rather than duplicate.
create unique index source_items_provider_item_unique
  on public.source_items (connection_id, provider_item_id)
  where connection_id is not null and provider_item_id is not null;
create index source_items_user_type_idx on public.source_items (user_id, source_type);
create index source_items_content_hash_idx on public.source_items (user_id, content_hash);

create trigger trg_source_items_updated_at
  before update on public.source_items
  for each row execute function public.set_updated_at();

-- ─── Candidate evidence ──────────────────────────────────────────────────────

create table public.candidate_evidence (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  evidence_type       text not null
    check (evidence_type in ('skill', 'project', 'role', 'achievement', 'metric', 'education',
                             'certification', 'responsibility', 'publication', 'leadership')),
  claim_text          text not null,
  normalized_value    text,
  normalized_unit     text,
  -- A ranking heuristic only. Truth comes from verification_status.
  confidence          numeric(4,3) check (confidence between 0 and 1),
  verification_status text not null default 'unreviewed'
    check (verification_status in ('unreviewed', 'user_confirmed', 'source_verified', 'rejected')),
  valid_from          date,
  valid_to            date,
  content_hash        text,
  claim_tsv           tsvector generated always as (to_tsvector('english', claim_text)) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index candidate_evidence_user_status_idx
  on public.candidate_evidence (user_id, verification_status);
create index candidate_evidence_tsv_idx on public.candidate_evidence using gin (claim_tsv);

create trigger trg_candidate_evidence_updated_at
  before update on public.candidate_evidence
  for each row execute function public.set_updated_at();

-- Embeddings sit in their own table so the model can change without rewriting
-- evidence. The column has no fixed dimension until the embedding model is
-- chosen (§8.6); add the ANN index in the migration that fixes it.
create table public.evidence_embeddings (
  evidence_id       uuid not null references public.candidate_evidence(id) on delete cascade,
  embedding_model   text not null,
  embedding_version text not null,
  content_hash      text not null,
  embedding         extensions.vector not null,
  created_at        timestamptz not null default now(),
  primary key (evidence_id, embedding_model, embedding_version)
);

create table public.evidence_sources (
  evidence_id     uuid not null references public.candidate_evidence(id) on delete cascade,
  source_item_id  uuid not null references public.source_items(id) on delete cascade,
  support_type    text not null default 'supports'
    check (support_type in ('supports', 'mentions', 'user_statement')),
  support_excerpt text,
  created_at      timestamptz not null default now(),
  primary key (evidence_id, source_item_id)
);

create index evidence_sources_source_item_idx on public.evidence_sources (source_item_id);

-- Graph-like links between evidence, kept in PostgreSQL (§5.5).
create table public.evidence_relations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  from_evidence_id uuid not null references public.candidate_evidence(id) on delete cascade,
  relation_type    text not null
    check (relation_type in ('demonstrates_skill', 'belongs_to_project', 'contributed_to_outcome',
                             'used_technology', 'supports_role_requirement', 'derived_from', 'contradicts')),
  to_evidence_id   uuid not null references public.candidate_evidence(id) on delete cascade,
  weight           numeric(4,3),
  metadata_json    jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  check (from_evidence_id <> to_evidence_id),
  unique (from_evidence_id, relation_type, to_evidence_id)
);

create index evidence_relations_from_idx on public.evidence_relations (user_id, from_evidence_id);
create index evidence_relations_to_idx on public.evidence_relations (user_id, to_evidence_id);
