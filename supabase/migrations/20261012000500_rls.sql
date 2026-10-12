-- Tracck v2 schema, part 5: row level security.
--
-- Business operations go through the API service, which connects with a
-- server-only role. RLS here is defense in depth (§10.1): a signed-in browser
-- can read its own rows and nothing else, and cannot write at all.
-- Tables with RLS enabled and no policy are reachable only by the server.

alter table public.profiles                  enable row level security;
alter table public.source_connections        enable row level security;
alter table public.source_connection_secrets enable row level security;
alter table public.source_items              enable row level security;
alter table public.candidate_evidence        enable row level security;
alter table public.evidence_embeddings       enable row level security;
alter table public.evidence_sources          enable row level security;
alter table public.evidence_relations        enable row level security;
alter table public.target_opportunities      enable row level security;
alter table public.background_jobs           enable row level security;
alter table public.resume_documents          enable row level security;
alter table public.generation_runs           enable row level security;
alter table public.resume_versions           enable row level security;
alter table public.resume_examples           enable row level security;
alter table public.role_rubrics              enable row level security;
alter table public.notifications             enable row level security;
alter table public.audit_events              enable row level security;

-- Tokens are never readable from the browser, with or without a policy.
revoke all on public.source_connection_secrets from anon, authenticated;
revoke all on public.audit_events from anon, authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy source_connections_select_own on public.source_connections
  for select to authenticated using ((select auth.uid()) = user_id);

create policy source_items_select_own on public.source_items
  for select to authenticated using ((select auth.uid()) = user_id);

create policy candidate_evidence_select_own on public.candidate_evidence
  for select to authenticated using ((select auth.uid()) = user_id);

create policy evidence_sources_select_own on public.evidence_sources
  for select to authenticated using (
    exists (
      select 1 from public.candidate_evidence e
      where e.id = evidence_id and e.user_id = (select auth.uid())
    )
  );

create policy evidence_relations_select_own on public.evidence_relations
  for select to authenticated using ((select auth.uid()) = user_id);

create policy target_opportunities_select_own on public.target_opportunities
  for select to authenticated using ((select auth.uid()) = user_id);

create policy background_jobs_select_own on public.background_jobs
  for select to authenticated using ((select auth.uid()) = user_id);

create policy resume_documents_select_own on public.resume_documents
  for select to authenticated using ((select auth.uid()) = user_id);

create policy generation_runs_select_own on public.generation_runs
  for select to authenticated using ((select auth.uid()) = user_id);

create policy resume_versions_select_own on public.resume_versions
  for select to authenticated using (
    exists (
      select 1 from public.resume_documents d
      where d.id = resume_document_id and d.user_id = (select auth.uid())
    )
  );

create policy notifications_select_own on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
