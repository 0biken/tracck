# Tracck — Technical Architecture (Revision 2)

**Document type:** Engineering architecture and implementation brief  
**Status:** Proposed source of truth for the next engineering cycle (Revision 2, incorporating reviewer feedback)  
**Audience:** Coding agent, backend/frontend engineers, product owner  
**Primary product outcome:** Produce accurate, evidence-backed, role-specific resumes and related career materials from a user's verified career context.

---

### Revision 2 summary

This revision keeps the structure of the previous version and closes the gaps left by the reviewer's feedback. Appendix A maps every review comment to the section that answers it. Appendix B lists discrepancies already visible in the public repository README, to seed the Phase 0 audit.

- **User-directed focus:** the user can say what the resume should emphasize, and pin or exclude evidence (§8.2 Stages 0 and 3, §9).
- **Graph-aware retrieval:** indexing happens at ingestion, and retrieval expands hits through `evidence_relations` (§8.1, §8.2 Stage 3).
- **Bounded evidence-lookup tool** for the generator and critic, replacing the earlier blanket "no tools" stance (§1, §8.2 Stage 5).
- **SSE is the recommended live-progress path**, with polling as the fallback (§2, §7.4, §9).
- **AI-engine quality:** role tone profiles, annotated bad examples, model tiering, an independent critic, and judge calibration (§5.9, §8.5–8.7).
- **Model data-handling check** before any provider receives candidate content (§8.6).
- **Cost-tiered extraction** at ingestion and no fixed look-back windows (§6.4).
- **Optional CV review** that suggests improvements to an uploaded CV (§6.3, Phase 4).

---

## 0. Instructions to the implementation agent

Treat this document as the target architecture, but **inspect the existing repository and deployment configuration before changing code**. Do not replace working components or introduce a second provider just because this document names a preferred pattern.

First, create `docs/architecture/IMPLEMENTATION_AUDIT.md` with:

1. The current frontend framework, backend entry points, auth approach, database, storage, queue, Redis providers, worker process, AI SDK/provider, and deployment services.
2. What currently exists versus what this document requires.
3. Duplicate or conflicting infrastructure (especially multiple Redis endpoints, overlapping backend logic, and email incorrectly modeled as a candidate source). Start from Appendix B, which lists gaps already visible in the public README.
4. A migration plan that preserves existing data and working user flows.
5. Any blockers caused by provider access, API permissions, secrets, or missing environment variables.

Then implement in small, testable phases. Do not perform a blind rewrite. Keep the existing language/framework unless a concrete repository limitation requires a change. If the repository contradicts an assumption here, document the discrepancy and propose the smallest safe adjustment before making a large migration.

**Important constraints:**
- No long-running resume-generation work inside a normal HTTP request.
- No business-critical workflow should depend on a browser tab staying open.
- No API token or secret may be exposed to the browser or sent to an LLM.
- No generated achievement, number, qualification, employer, project, or skill may be represented as a verified fact without supporting candidate evidence or user confirmation.
- Do not scrape a source or promise fields that the official API and approved scopes do not provide.
- Do not use email delivery as a data-source integration. Email is a notification channel.
- Do not introduce a dedicated graph database unless the repository already uses one or a documented benchmark demonstrates the need. Build graph-like relationships in PostgreSQL first.

## 1. Product and architecture goals

Tracck is not merely a resume text generator. It should create a structured, permissioned model of a candidate's background, retrieve evidence that is relevant to a target role, generate a tailored document, critique it against role-specific standards, and validate the result before showing it to the user.

### Goals

- Import allowed career evidence from connected services, uploaded CVs, portfolios, user-entered work history, and a target job description.
- Process account imports and resume generation asynchronously.
- Store normalized source records, candidate claims, relationships, embeddings, jobs, and versioned resume artifacts.
- Retrieve a small, ranked, explainable subset of evidence for each generation rather than passing every post or profile record to the model.
- Support role-specific generation instructions, examples, and evaluation rubrics.
- Use a critique-and-revision pipeline with factuality checks and bounded attempts.
- Make job status, partial progress, errors, retries, and cancellation visible to the user.
- Respect user consent, provider permissions, rate limits, privacy settings, token security, and data-deletion requirements.
- Keep the model provider swappable and evaluate models with repeatable test cases.

### Non-goals for the initial implementation

- Building a universal social-media scraper.
- Importing every possible social post regardless of permission or relevance.
- Using a multi-agent framework or an autonomous web-browsing agent. A deterministic pipeline is the default. The only model-callable tool in the initial implementation is the bounded, read-only evidence lookup described in §8.2 Stage 5.
- Requiring Neo4j or another separate graph database before retrieval quality has been measured.
- Generating a resume from one unstructured prompt with no evidence tracking or evaluation.
- Making LinkedIn or X imports a hard dependency for the core resume workflow.

## 2. Architecture decisions

These are the proposed defaults. The implementation audit should confirm them against the repository and deployment account.

| Area | Decision | Reason / implementation note |
|---|---|---|
| Frontend | Keep the framework and UI stack already in the repository | Avoid unnecessary rewrite; UI communicates with the backend API. |
| Application backend | A dedicated HTTPS API service deployed on Railway, or the existing equivalent if already stable | Owns business rules, source integrations, authorization, job creation, and read/write endpoints. |
| Background processing | A separate always-on worker service using the same application codebase and job handlers | Long-running imports, parsing, embedding, retrieval, generation, critique, exports, and cleanup run here. |
| Main database | PostgreSQL managed by Supabase, if that is already the intended database | Stores durable product state. Use relational tables and `pgvector` where appropriate. Do not treat Supabase Realtime or Edge Functions as the job system. |
| Authentication | Preserve the identity provider already implemented | The API must validate identity tokens and enforce authorization itself. If Supabase Auth is already used, it may remain the identity issuer, but business operations should go through the API. Do not migrate auth casually. |
| Queue | BullMQ with one Redis endpoint | Prefer the existing Railway-hosted Redis if it is provisioned and reachable by both API and worker. Otherwise choose one supported persistent Redis provider. Remove the unused second Redis configuration. |
| Object storage | Use the existing private object-storage provider. If none exists, add one S3-compatible private bucket | Uploaded CVs and generated PDF/DOCX files are binary objects, not rows or Redis values. Keep buckets private and use short-lived signed URLs. |
| AI providers | Provider adapter interface with configured model IDs | Benchmark DeepSeek and suitable Gemini/current alternatives on Tracck's own test set before selecting a default. Avoid hard-coding a model name throughout the code. |
| Candidate retrieval | PostgreSQL full-text/metadata filters + `pgvector`; relational evidence links in PostgreSQL with bounded graph expansion over `evidence_relations` | Supports a first version of hybrid retrieval without the operational cost of synchronizing two databases. Reassess dedicated graph storage using evidence from tests. |
| Notifications | In-app live job status via SSE (the API runs on a long-lived service) with API polling as the fallback; transactional email through a separate email provider | Email is a delivery mechanism only. Notifications are not the source of truth for job state. |
| Scheduling | Queue-delayed/repeatable jobs or a dedicated scheduler for periodic sync and cleanup | Keep scheduling logic explicit and monitored. Do not rely on a web request being open. |

### One-provider rule for Redis

There must be exactly one active Redis connection for the queue unless there is a documented reason for a separate cache. Do not configure the same queue against Railway Redis and Upstash Redis in parallel. The database is the durable source of truth; Redis is for queue coordination and disposable short-lived data. If Redis is lost, recover or re-enqueue jobs from durable database state.

### Supabase boundary

Supabase/PostgreSQL is the durable data layer. Do not split the same business workflow between Supabase Edge Functions, Railway API routes, database triggers, and a second backend. Keep business logic in the API/worker codebase. Database constraints, indexes, row-level protections, and migrations remain appropriate at the database layer. If the existing application already uses Supabase Auth, retain it as identity infrastructure rather than rebuilding login as part of this task.

Concretely: remove any database trigger, Realtime subscription, or webhook that enqueues work or calls another service (for example an `INSERT` trigger on an imported-posts table that starts AI processing). Job creation happens in the API (§7.2) and the worker moves state forward. Supabase Auth, if already in use, remains the identity issuer only.

## 3. High-level system map

```text
Browser / Frontend
  | HTTPS + user identity token
  v
Tracck API service (Railway)
  |-- validates identity and ownership
  |-- validates input and permissions
  |-- writes durable job record in PostgreSQL
  |-- enqueues job ID to BullMQ / Redis
  |-- returns 202 Accepted + job ID
  |
  +--------------------> PostgreSQL (Supabase)
  |                       - users / profiles
  |                       - connections / imported sources
  |                       - candidate evidence + relationships
  |                       - embeddings / job descriptions
  |                       - jobs / generation runs / resume versions
  |                       - notifications / audit events
  |
  +--------------------> Private Object Storage
  |                       - CV uploads / parsed source artifacts
  |                       - generated PDF / DOCX exports
  |
  +--------------------> Email provider (notification delivery only)

BullMQ / single Redis endpoint
  ^                 |
  | enqueue         | dequeue
  |                 v
API service     Background worker service (Railway)
                    |-- source connector adapters
                    |-- import and parse pipeline
                    |-- normalize and index evidence
                    |-- hybrid retrieval and ranking
                    |-- model provider adapter
                    |-- draft -> critique -> revise -> validate
                    |-- store result and publish job state
                    |
                    +--> external provider APIs (permitted scopes only)
                    +--> LLM / embedding APIs (selected evidence only)
```

**Ownership:** PostgreSQL owns durable state. Redis transports jobs. The worker executes jobs. The API owns authorization and user-facing contracts. Email merely notifies. The frontend renders status but does not orchestrate backend work.

## 4. Service responsibilities

### 4.1 Frontend

The frontend should:

- Provide onboarding, source-connection management, CV upload, profile review, target-role/job-description input, resume generation, resume editing, export, and job history.
- Display each connected source's state: `not_connected`, `connected`, `sync_queued`, `syncing`, `synced`, `partial`, `needs_reauth`, or `error`.
- Submit a job and receive a job ID instead of waiting for generation to finish in the same request.
- Show progress based on persisted job steps, not a guessed spinner timer.
- Allow the user to leave the page and return later to view the job and output.
- Show partial-import warnings when an integration cannot provide a field or reaches an API limit.
- Explain what data will be imported and request consent before an import starts.
- Never receive provider refresh tokens, LLM keys, Redis credentials, database service-role keys, or storage secrets.

### 4.2 API service

Responsibilities:

- Authenticate each request and enforce per-user ownership.
- Validate request schemas, payload size, upload metadata, and rate limits.
- Manage OAuth callbacks and source connections, where supported.
- Create durable import and generation jobs in PostgreSQL, then enqueue their IDs.
- Serve job status, generated resumes, profile/source data, and signed download links.
- Implement idempotency for job-creating endpoints.
- Return stable error codes and correlation IDs.
- Apply per-user limits and usage controls before costly LLM work.
- Keep all provider API access and LLM calls server-side.

The API must not perform the full import, embedding, generation, or critique loop during a standard request.

### 4.3 Worker service

Responsibilities:

- Consume queue jobs and update durable status before and after each major step.
- Run idempotent import, parsing, indexing, generation, critique, export, sync, and cleanup handlers.
- Retry transient failures with bounded exponential backoff and jitter.
- Respect provider rate-limit responses, `Retry-After` values, quota/cost limits, and cancellation requests.
- Persist structured error codes and safe user-facing error messages; do not put credentials or full private document contents into logs.
- Mark permanently failed jobs and expose a retry action where appropriate.
- Reconcile queued/running database jobs with Redis after restarts or outages.

Worker concurrency must be configurable separately for import, embedding, generation, and export work. Concurrency should be low enough to honor external API quotas and model budgets.

### 4.4 PostgreSQL / pgvector

Use PostgreSQL for canonical structured state, foreign-key relationships, transactional updates, job history, versions, and access controls. Use `pgvector` for semantic retrieval if supported by the selected embedding model and database configuration. Add indexes based on actual queries and retrieval benchmarks.

Do not store mutable resume state exclusively in the queue or cache. Do not place large CV/PDF binary payloads directly in database rows.

### 4.5 Redis / BullMQ

Redis is a queue backend, not the authoritative job database. Queue messages should contain identifiers and small execution metadata, such as `{ jobId, userId, type, schemaVersion }`, not the complete CV, source history, OAuth tokens, or entire LLM prompt.

Queue handlers must be safe if a job is delivered more than once. Use database uniqueness constraints, idempotency keys, and checkpointed steps to prevent duplicated source records or duplicate finalized resume versions.

### 4.6 Private object storage

Use private paths keyed by user and object ID, not user-supplied file names. Validate actual file type, extension, size, and parsing result. Generate signed download URLs only after authorization. Avoid public buckets for CVs, generated resumes, or imported artifacts. Apply lifecycle/retention rules to temporary artifacts.

## 5. Core domain model and database design

The implementation agent should map these entities to the current schema and create migrations rather than blindly creating duplicates. Names below are logical names; adapt to the repository's naming convention.

### 5.1 Users and candidate profile

**`profiles`**

- `id` (UUID, primary key; links to auth identity)
- `display_name`, `headline`, `location` (nullable, user-editable)
- `summary` (nullable)
- `career_level` (nullable enum or text)
- `preferred_roles` (array or related table)
- `preferences_json` (validated JSON: tone, length, section choices, layout preference)
- `created_at`, `updated_at`

Keep candidate facts as normalized evidence as well as editable presentation fields; do not treat an AI summary as the only representation of a user.

### 5.2 Source connections and permissions

**`source_connections`**

- `id`, `user_id`, `provider` (`github`, `linkedin`, `x`, etc.)
- `provider_account_id`, `display_handle` (where allowed)
- `status`, `granted_scopes`, `connected_at`, `last_sync_at`, `last_error_code`
- `token_secret_ref` or encrypted token fields handled only server-side
- `consent_version`, `revoked_at`, `created_at`, `updated_at`

Access/refresh tokens must be encrypted at rest where stored; prefer a managed secret/KMS pattern if already available. Never return token values from the API. Store only the minimum scopes and fields needed. On disconnect, revoke tokens when the provider supports revocation and queue deletion/reconciliation of retained source data according to policy.

### 5.3 Source records and imported items

**`source_items`**

- `id`, `user_id`, `connection_id` (nullable for uploads/manual entries)
- `source_type` (`github_repo`, `github_contribution`, `social_post`, `portfolio_page`, `uploaded_cv`, `manual_experience`, `job_description`, etc.)
- `provider_item_id` (nullable), `canonical_url` (nullable), `title`, `body_text`
- `source_created_at`, `imported_at`, `updated_at`, `content_hash`
- `raw_object_key` (nullable; private object storage reference)
- `permissions_json`, `metadata_json`, `deletion_status`

Add a unique constraint such as `(connection_id, provider_item_id)` when both values are present, so repeat imports update rather than duplicate records. Imported records must be associated with the user who authorized them.

### 5.4 Candidate evidence — the central intelligence layer

**`candidate_evidence`** represents discrete, reviewable claims supported by one or more source items. Examples: “built a TypeScript API,” “led a team of four,” “improved test coverage,” or “maintained a project used by X users.”

Suggested fields:

- `id`, `user_id`
- `evidence_type` (`skill`, `project`, `role`, `achievement`, `metric`, `education`, `certification`, `responsibility`, `publication`, `leadership`)
- `claim_text`, `normalized_value` (nullable), `normalized_unit` (nullable)
- `confidence`, `verification_status` (`unreviewed`, `user_confirmed`, `source_verified`, `rejected`)
- `source_item_ids` or a join table linking many sources to the evidence
- `valid_from`, `valid_to`, `created_at`, `updated_at`
- `embedding` in a vector column or related embedding table
- `embedding_model`, `embedding_version`, `content_hash`

Prefer a join table `evidence_sources(evidence_id, source_item_id, support_type, support_excerpt)` if evidence can be supported by multiple sources. Keep original source URLs/IDs where permissible so the UI can explain where a claim came from.

`confidence` is a ranking heuristic and must never be read as truth; `verification_status` is the truth signal.

If an imported item contains an ambiguous number or claim, preserve it as unverified. Do not infer a numerical achievement solely because it would make a resume sound stronger.

### 5.5 Graph-like relationships in PostgreSQL

**`evidence_relations`** models links between entities/evidence without requiring a separate graph database on day one:

- `id`, `user_id`
- `from_evidence_id`, `relation_type`, `to_evidence_id`
- `weight` (optional), `metadata_json`, `created_at`

Initial relation types may include `demonstrates_skill`, `belongs_to_project`, `contributed_to_outcome`, `used_technology`, `supports_role_requirement`, `derived_from`, and `contradicts`.

Use foreign keys, ownership checks, indexes, and cycle-safe queries. Keep graph traversals bounded. Reassess a dedicated graph database only if multi-hop retrieval is demonstrably important and hard to meet with this representation.

### 5.6 Job descriptions and target roles

**`target_opportunities`**

- `id`, `user_id`, `title`, `company` (nullable), `job_url` (nullable), `job_description_text`
- `role_family`, `seniority`, `location` (nullable)
- `requirements_json` (parsed requirements with stable IDs and importance)
- `embedding`, `created_at`, `updated_at`

Each target job should produce an explicit requirement list, for example: required skills, preferred skills, responsibilities, collaboration expectations, domain context, and measurable outcomes. Preserve the original job description for review and rerun parsing when needed.

### 5.7 Resume documents and versioning

**`resume_documents`**

- `id`, `user_id`, `target_opportunity_id` (nullable)
- `title`, `status`, `current_version_id`, `created_at`, `updated_at`

**`resume_versions`**

- `id`, `resume_document_id`, `version_number`, `content_json`, `plain_text`, `layout_key`
- `generation_run_id`, `created_by` (`ai`, `user`, `import`)
- `validation_summary_json`, `created_at`
- optional `pdf_object_key`, `docx_object_key`, `export_status`

Store canonical resume content as structured JSON (sections, entries, bullets, links, evidence references), not only as rendered HTML or a PDF. Editing should create a new version or explicit revision record; avoid destructive overwrites.

### 5.8 Jobs and pipeline tracking

**`background_jobs`**

- `id`, `user_id`, `job_type` (`source_import`, `cv_parse`, `cv_review` (optional, later phase), `profile_index`, `resume_generation`, `resume_export`, `source_sync`, `cleanup`)
- `status`, `step`, `progress_percent` (optional), `attempt_count`, `max_attempts`
- `idempotency_key`, `input_ref_json`, `result_ref_json`
- `error_code`, `safe_error_message`, `correlation_id`
- `created_at`, `started_at`, `heartbeat_at`, `completed_at`, `cancel_requested_at`

Persist the job state before enqueueing, then enqueue the durable ID. If enqueueing fails, keep the database record in a re-enqueueable state and alert/reconcile. Do not acknowledge a request as accepted unless a durable job record exists.

**`generation_runs`**

- `id`, `user_id`, `target_opportunity_id`, `resume_document_id`
- `status`, `model_provider`, `model_id`, `prompt_version`, `rubric_version`, `retrieval_config_version`
- `user_focus_json` (free-text focus, pinned and de-emphasized evidence), `tool_calls_json` (bounded evidence lookups)
- `retrieved_evidence_ids`, `example_ids`, `metrics_json`, `token_usage_json`, `cost_estimate`
- `started_at`, `completed_at`, `failure_code`

Store enough provenance to diagnose bad output without logging full prompts containing personal data. Use controlled retention and redaction for detailed traces.

### 5.9 Role-specific examples and rubrics

**`resume_examples`**

- `id`, `role_family`, `seniority`, `locale`, `layout_key`
- `example_kind` (`good` or `annotated_bad`), `example_content_json`, `annotations_json` (for bad examples: what is wrong and why)
- `quality_notes`, `rights_status`, `active`, `version`

Only use examples that Tracck owns, has permission to use, or has created synthetically. Remove personally identifying information. Examples are guidance for structure and quality, not evidence about the candidate.

Seed several examples per role family and seniority. Add annotated bad examples as well (generic bullets, task lists with no outcome, keyword stuffing, invented metrics) so the critique stage has concrete failure patterns to look for. Pass good examples to the generator and both kinds to the critic.

**`role_rubrics`**

- `id`, `role_family`, `seniority`, `version`, `criteria_json`, `weights_json`, `tone_profile_json`, `active`

Rubrics should be versioned and tested. Avoid scoring all professions with one global rule. An engineering rubric may care about technical scope, code/projects, system quality, and impact; a product rubric may care about prioritization, discovery, delivery, stakeholder management, and outcomes.

### 5.10 Notifications and audit records

**`notifications`** should reference the job/result and store delivery status, channel, template, and timestamps. **`audit_events`** should record security-relevant actions such as connection creation/revocation, data export, deletion request, and authorization failures. Avoid copying sensitive document contents into audit events.

## 6. Source integrations and onboarding

### 6.1 Source types are not interchangeable

The system must distinguish:

- **Evidence sources:** GitHub, approved X/LinkedIn API fields, uploaded CVs, portfolio pages, manual work history, certificates, projects, publications, and a target job description.
- **Notification providers:** email and in-app notifications.
- **Infrastructure providers:** database, Redis, object storage, logging, and hosting.
- **AI providers:** chat/generation models and embedding models.

An email provider must not appear in a “career data sources” selector. It may appear under notification settings.

### 6.2 Onboarding flow

1. User signs in and reviews what Tracck does and what information it may import.
2. User can connect sources during onboarding, skip a source, or provide a CV/portfolio manually. Never make a restricted integration mandatory for the core product.
3. For each OAuth source, redirect to provider authorization with least-privilege scopes and `state` protection (and PKCE where supported).
4. API validates the callback, stores credentials securely, creates a `source_import` background job, and returns the UI to onboarding.
5. Worker fetches permitted records with pagination, deduplication, backoff, and checkpoints. It records how far the import progressed and which types were unavailable.
6. Worker normalizes source records, extracts candidate evidence, indexes it, and updates source/job status.
7. UI shows per-source results, missing permissions, and reviewable evidence. User may correct or reject inferred facts.
8. The user can run a generation job even if optional sources failed, as long as sufficient candidate evidence exists.

### 6.3 Provider capability registry

Implement a small source-adapter interface and capability metadata. Each adapter should declare available operations, OAuth scopes, pagination behavior, rate-limit strategy, supported fields, and known limitations. Hide unsupported UI options instead of pretending the API provides unavailable data.

Examples:

- **GitHub:** start with permitted profile, repository, README, language, release/contribution signals, and other approved fields that can be accessed with granted scopes. Do not imply that the API can prove a user's exact contribution or business impact without evidence.
- **X:** import only the records and fields provided by the currently approved API access level, authentication method, user consent, and applicable policy. Usage is quota/rate limited and may incur cost. Verify endpoint availability in the active developer account before enabling the feature.
- **LinkedIn:** do not assume general access to a member's full profile, activity, or posts. Its profile APIs and permissions are restricted. Confirm approved product access, scopes, and storage terms. If unavailable, accept a user-uploaded CV or user-provided profile details instead.
- **Portfolio URLs:** only fetch public pages where allowed. Restrict URL fetching to mitigate SSRF: block localhost, private IP ranges, link-local metadata endpoints, disallowed schemes, oversized bodies, and redirect chains into private networks. Prefer a safe parser over executing arbitrary scripts.
- **CV uploads:** accept a defined set of formats (initially PDF and DOCX; add others only with tests), enforce size limits, parse in a worker, and offer the extracted facts for user correction. Optionally (later phase), run a separate non-blocking `cv_review` job that suggests improvements, such as vague bullets, outcomes the user could supply, and ATS-unfriendly formatting. Suggestions never change evidence automatically.
- **Manual entry:** let the user enter/edit experience, projects, skills, education, certifications, and measurable outcomes.
- **Job descriptions:** accept pasted text or a permitted URL import. The user can edit the parsed description before generation.

### 6.4 Import behavior

- Fetch and paginate records allowed by the provider; do not stop at an arbitrary “50 posts” limit unless a configured budget or provider limit requires it. Avoid fixed look-back windows (for example the last 90 days) unless the provider forces one, and backfill older history in the background.
- Store every permitted record in `source_items` first. Extract evidence in tiers: deterministic filters and cheap classification first, embeddings next, and an expensive model only on items that survive. Never run the strongest model over every raw post.
- Persist checkpoints/cursors so a failed import resumes without restarting from zero.
- Use upserts and content hashes to prevent duplicates.
- Record partial imports and missing-field errors without marking the entire import as a failure if usable evidence was imported.
- Use scheduled background sync only if the provider's terms, rate limits, token lifetime, and product value support it. Otherwise use on-demand refresh.
- Track source freshness. If content is deleted or access is revoked, follow provider rules and Tracck's retention policy.

## 7. Asynchronous jobs and user-visible status

### 7.1 Required job lifecycle

Use a controlled enum, for example:

`queued -> running -> succeeded`

Other valid transitions: `queued -> cancelled`, `running -> retry_wait`, `retry_wait -> running`, `running -> failed`, `running -> cancelled`, and `running -> needs_user_action` where a user must reconnect an account or confirm missing data.

Store the current step separately, such as `download_source`, `parse_cv`, `normalize`, `embed`, `retrieve`, `draft`, `critique`, `revise`, `validate`, `export`, or `notify`.

### 7.2 Job creation contract

For a request such as `POST /v1/resume-generations`:

1. Authenticate and authorize the user.
2. Validate the target opportunity, selected sources, preferences, optional user focus, and idempotency key.
3. Insert a `background_jobs` record with status `queued` and a `generation_runs` record in one database transaction.
4. Commit the transaction.
5. Enqueue the `background_jobs.id` to BullMQ.
6. Return `202 Accepted` with `{ jobId, statusUrl, resultUrl }`.
7. If enqueueing fails, record the enqueue error and let a reconciler enqueue it later; do not lose the request.

### 7.3 Worker reliability requirements

- Queue messages contain IDs; load authoritative inputs from PostgreSQL.
- Handler can safely be executed more than once.
- Use a heartbeat so abandoned `running` jobs can be recovered.
- Retries are bounded; do not endlessly retry validation failures, revoked tokens, unsupported formats, or bad input.
- Retry 429/temporary network/5xx failures according to provider guidance and exponential backoff with jitter.
- Persist step transitions and partial progress.
- Cancellation is cooperative: workers check `cancel_requested_at` between expensive steps.
- Limit model retries and the generation critique loop to a small configurable count.
- Provide an admin/operator way to inspect failed jobs and requeue safely, without exposing personal document content unnecessarily.
- Add a reconciliation process for stale `queued` jobs not present in Redis and stale `running` jobs whose heartbeat expired.

### 7.4 Progress updates

Expose `GET /v1/jobs/{jobId}/events` as a Server-Sent Events stream. The API runs on a long-lived service, so held connections are supported; confirm proxy and idle timeouts in the Phase 0 audit. Each event notifies the client of persisted state (`step`, `status`, `progress_percent`, warnings) and carries an event ID so a reconnecting client resumes with `Last-Event-ID`.

Keep `GET /v1/jobs/{jobId}` as the polling fallback for clients that cannot hold a stream, and always as the source of truth. SSE messages are never authoritative. Worker-to-API fan-out may use Redis pub/sub on the existing endpoint, which is a disposable transport: a missed message must not leave the UI stale, so the client re-reads job state on reconnect. If the client disconnects, the job continues and its final result remains retrievable, and the user is notified by email and in-app when it completes.

### 7.5 Email notifications

Use the email provider only for events such as “resume generation completed,” “source connection needs reauthorization,” and “import finished with warnings,” subject to user notification preferences. A failed email must never change a completed generation job to failed. Deduplicate notification sends using an idempotency key.

## 8. Resume generation and AI-engine design

### 8.1 Principle: evidence first, generation second

The AI must not receive the entire raw account history by default. The pipeline should first determine what the user is targeting, then retrieve and rank evidence that best supports the target requirements. The selected evidence and its provenance become explicit generation inputs.

Indexing happens at ingestion, not at generation time. Evidence is normalized, embedded, and linked through `evidence_relations` by `profile_index` jobs as data arrives, so a generation request only runs retrieval over an already-indexed store.

### 8.2 Generation pipeline

**Stage 0 — Validate request**

- Confirm user has permission to use the selected source data.
- Confirm the target job description and desired role are available.
- Check usage quotas, model budget, document limits, and input length.
- Record prompt, rubric, retrieval, and model configuration versions.
- Accept an optional user focus: free-text instructions (for example, emphasize testing and CI work), evidence the user pins as must-include, and evidence or themes the user wants de-emphasized. Store it on the generation run.

**Stage 1 — Build a candidate snapshot**

- Load normalized candidate evidence and verified profile fields.
- Exclude rejected claims and respect user exclusions.
- Identify missing important information. Ask the user a focused question or generate with a transparent warning rather than inventing an answer.
- Create a stable snapshot for this generation run so concurrent profile edits do not silently alter a running job.

**Stage 2 — Parse the job description**

Produce structured requirements with IDs and fields such as `requirement_type`, `text`, `importance`, `required_or_preferred`, `skills`, `seniority`, and optional inferred role family. The user should be able to review or edit these requirements before generation, especially when automated parsing confidence is low.

**Stage 3 — Retrieve candidate evidence**

Use a hybrid retrieval path:

1. Apply hard filters for user ownership, source permissions, verification status, relevant date range, and user-selected exclusions.
2. Retrieve by keyword/full-text and semantic similarity to each job requirement.
3. Add metadata signals such as role relevance, project relevance, evidence freshness, confidence, and source provenance.
4. Expand the top hits through `evidence_relations`, bounded to two hops, to pull in linked evidence such as the project behind a skill or the outcome behind a task. Apply the same filters to expanded items.
5. Deduplicate near-identical evidence and diversify the final context so one source does not crowd out different but useful evidence.
6. Optionally rerank a small candidate set using a lightweight model or deterministic scorer.
7. Keep evidence IDs, scores, reasons, and source references for debugging and explainability.

A starting ranking formula may combine semantic similarity, lexical match, requirement importance, evidence confidence, and freshness, but treat weights as configuration. Tune them with a labeled dataset. Do not assume semantic similarity alone means evidence is true or useful.

Treat the user's focus text as an additional retrieval query alongside the job requirements, and force pinned evidence into the candidate set (still subject to exclusions and verification status). Focus steers emphasis only and cannot authorize unsupported claims. If the user supplies a new fact, store it as `user_confirmed` evidence first so it has an evidence ID.

**Stage 4 — Select role-specific examples and rubric**

Retrieve several permitted examples matched by role family, seniority, desired layout, and locale. Use them to guide structure, specificity, and tone, not to copy candidate details. Load the correct role rubric and version. A single global scoring rubric is not sufficient.

**Stage 5 — Draft structured resume content**

The generator should produce schema-valid JSON, not final PDF markup. Include:

- Resume sections and ordering.
- Professional summary or headline, if appropriate for the target role.
- Skills and experience entries.
- Achievement bullets with specific actions, context, and outcomes when evidence supports them.
- Project entries and relevant links.
- A list of evidence IDs supporting each factual bullet/claim.
- Optional warnings or questions for unsupported/missing information.

Never invent metrics. If the evidence says a project exists but does not provide user counts, revenue, time savings, scale, or coverage, do not fabricate those figures.

**Bounded evidence lookup (optional, behind a feature flag).** The generator and critic may call one read-only tool, `search_evidence(query, filters)`, to pull additional evidence from the same generation snapshot when the initial context is thin. The server executes it. It is limited to the user's snapshot, capped at a small configurable number of calls per run, and returns evidence IDs and excerpts only. Each call is logged in `generation_runs.tool_calls_json`. The model gets no network access, no write access, and no tool that touches other users' data or source providers. Text returned by the tool is still untrusted data (§8.4).

**Stage 6 — Deterministic validation**

Check JSON schema, required sections, excessive length, duplicate bullets, impossible dates, invalid URLs, empty text, unsupported claims without evidence IDs, and forbidden/private information. Validate that each included evidence ID belongs to this user and was in the generation snapshot.

**Stage 7 — Critique**

Run a structured evaluator using the target job description, role rubric, source evidence, and reference examples. Score separate dimensions such as:

- Role relevance and coverage of required skills.
- Specificity and evidence-backed impact.
- Clarity and conciseness.
- Readability and appropriate tone.
- Duplication and filler.
- Unsupported or overstated claims.
- Formatting/ATS parseability.
- Completeness and role-specific expectations.

Return a JSON critique with criterion IDs, severity, evidence for each issue, and proposed fix. Avoid vague feedback such as “make it better.”

**Stage 8 — Bounded revision loop**

If the result fails the configured quality threshold, send the draft plus actionable critique back to the generator. Re-run deterministic validation and critique. Start with no more than two revision attempts; make the cap configurable and record cost. Stop early when the result passes or when additional revisions are not improving scores.

**Stage 9 — Finalize and persist**

- Save the final structured document as a new `resume_version`.
- Save rubric scores, validation results, evidence references, model metadata, and usage/cost data.
- Mark job and generation run `succeeded` only after the result is durably stored.
- Notify the UI/email system after successful persistence.

**Stage 10 — Export**

Render from canonical structured content to PDF/DOCX using a controlled template system. Export is its own idempotent job if rendering can be slow. After generation, let the user edit content and rerun export without needing to rerun AI generation.

### 8.3 Suggested structured output format

Adapt names to the existing code, but preserve the principles:

```json
{
  "schemaVersion": "1.0",
  "targetRole": "Software Engineer in Test",
  "sections": [
    {
      "type": "summary",
      "title": "Professional Summary",
      "content": "...",
      "evidenceIds": ["ev_123"]
    },
    {
      "type": "experience",
      "title": "Experience",
      "entries": [
        {
          "organization": "Example Company",
          "role": "QA Engineer",
          "startDate": "2025-02",
          "endDate": "2025-05",
          "bullets": [
            {
              "text": "Designed and maintained ...",
              "evidenceIds": ["ev_123", "ev_456"],
              "claimStatus": "supported"
            }
          ]
        }
      ]
    }
  ],
  "warnings": [],
  "openQuestions": []
}
```

The generator must not be allowed to insert arbitrary `evidenceIds`. The server validates every ID against the user's eligible candidate snapshot before accepting the output.

### 8.4 Prompt and input construction

Use prompt templates stored in version control or a prompt registry with explicit version identifiers. Separate system rules, target requirements, selected candidate evidence, examples, output schema, and critique instructions. Avoid one giant opaque prompt.

Treat all source material as untrusted data. A GitHub README, social post, portfolio page, or uploaded CV may contain text that looks like instructions to the model. Delimit source content, state that source text is evidence rather than instruction, and do not let source text override system policies or trigger tools. The model must not receive OAuth tokens or infrastructure secrets.

### 8.5 Role-specific generation and evaluation

Create versioned configurations for role families (initial examples: software engineering, QA/testing, data, product/project management, design, cybersecurity). Each configuration should define:

- The aspects that are valuable for that role.
- Which resume sections may be prioritized.
- Wording and specificity expectations.
- A tone profile (voice, preferred action verbs, formality, and how to phrase outcomes when no metric exists) so output does not read as generic template text.
- The evaluation criteria and weights.
- Common quality failures.
- Applicable example resume IDs.

Do not pretend the initial role list is exhaustive. For an unknown role, fall back to a general rubric and tell the user that role-specific evaluation is not yet tuned.

### 8.6 AI provider abstraction and model choice

Define an internal interface such as:

- `generateStructuredResume(input, config)`
- `critiqueResume(input, rubric)`
- `createEmbedding(texts, modelConfig)`
- optional `rerankEvidence(query, candidates, config)`

Implement providers behind adapters. Provider configuration should include `provider`, `model_id`, `temperature`/reasoning settings where supported, timeout, max output budget, retry behavior, and structured-output mode. Store the exact provider and model ID per generation run.

Compare at least one suitable current Gemini model and one suitable DeepSeek model using the same evaluation set. Include alternatives only when the provider can meet required JSON validity, privacy, latency, capacity, and cost. Do not choose a model based only on popularity or a generic benchmark. Keep the generation model and embedding model separately configurable; if embedding model/version/dimension changes, re-embed affected records safely.

**Model tiering.** The AI engine is the core value proposition, so spend model capacity where quality is decided. Use a strong model for drafting and critique, and cheaper models for bulk steps such as classification, normalization, and embeddings. Make the critic independently configurable, and test a critic from a different model family than the generator, because a model tends to score its own style favorably. Record the model ID per stage in `generation_runs`.

**Data handling for model choice.** Check where each provider processes and retains data before sending candidate content to it. DeepSeek's first-party API has historically processed data on servers in China, so confirm its current terms, consider an open-weight model served by a host you have vetted, and complete a data-protection review (for example, the Nigeria Data Protection Act if serving Nigerian users, including cross-border transfer rules) before CV or profile content is sent. Apply the same review to every provider.

### 8.7 Quality test set

Build a version-controlled test set containing representative candidate profiles, multiple job descriptions, and expected evaluation notes for different role families and seniority levels. Use synthetic or consented test data. Test:

- Groundedness: every factual claim maps to evidence or explicit user input.
- Job match: important requirements are covered when evidence exists.
- Non-invention: unsupported numbers and skills do not appear.
- Robustness: sparse profiles, contradictory dates, long CVs, missing social permissions, malformed source items, and prompt injection inside documents.
- Consistency: same inputs/configuration yield acceptably similar quality.
- Model/provider failure and malformed JSON handling.
- Cost, latency, and retry rate.

Track rubric scores across model/prompt/retrieval changes to detect regressions. A model's self-reported score alone is not a quality benchmark. Calibrate the critique stage against human judgment: have people rate a sample of outputs, check that the critic's scores track those ratings, and repeat the check whenever the critic model or rubric changes.

## 9. API surface (proposed contract)

Use the route style already present in the repository; the following are logical endpoints. All user endpoints require authentication unless noted. Every endpoint must enforce ownership on every referenced ID.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/v1/me` | Fetch current user's profile and product settings. |
| `PATCH` | `/v1/me/profile` | Update candidate profile/preferences. |
| `GET` | `/v1/sources` | List supported source types and current connection states. |
| `POST` | `/v1/connections/{provider}/start` | Begin OAuth flow; return provider redirect URL. |
| `GET` | `/v1/connections/{provider}/callback` | Validate OAuth callback and create connection. |
| `DELETE` | `/v1/connections/{connectionId}` | Disconnect/revoke a source and begin data handling workflow. |
| `POST` | `/v1/source-imports` | Queue an import or resync for a connection. |
| `POST` | `/v1/uploads/cv` | Create secure upload intent or accept validated upload metadata. |
| `POST` | `/v1/candidate-evidence` | Add user-confirmed experience/project/skill manually. |
| `GET` | `/v1/candidate-evidence` | Read/filter candidate evidence. |
| `PATCH` | `/v1/candidate-evidence/{evidenceId}` | Confirm, correct, reject, or edit evidence. |
| `POST` | `/v1/opportunities` | Create/update target job description and parsed requirement set. |
| `POST` | `/v1/resume-generations` | Create generation job (accepts optional `userFocus`); return `202 Accepted` and job ID. |
| `POST` | `/v1/cv-reviews` | (Optional, later phase) Queue a non-blocking CV improvement review. |
| `GET` | `/v1/jobs/{jobId}` | Fetch persisted state, step, warnings, and safe error information (polling fallback and source of truth). |
| `GET` | `/v1/jobs/{jobId}/events` | SSE stream of persisted job-state changes; supports `Last-Event-ID`. |
| `POST` | `/v1/jobs/{jobId}/cancel` | Request cancellation when supported. |
| `POST` | `/v1/jobs/{jobId}/retry` | Retry eligible failed jobs after authorization/validation. |
| `GET` | `/v1/resumes` | List saved resume documents. |
| `GET` | `/v1/resumes/{resumeId}` | Fetch resume and selected version. |
| `PATCH` | `/v1/resumes/{resumeId}` | Save user edits as a new version or revision. |
| `POST` | `/v1/resumes/{resumeId}/exports` | Queue PDF/DOCX export. |
| `GET` | `/v1/notifications` | Fetch in-app notifications. |
| `POST` | `/v1/me/data-deletion` | Request account/source data deletion workflow. |

### API rules

- Use a consistent JSON error envelope, e.g. `{ "error": { "code": "SOURCE_REAUTH_REQUIRED", "message": "Reconnect this account to continue.", "correlationId": "..." } }`.
- Use `202 Accepted` for long-running work. Never leave the browser waiting for generation output in the original request.
- Require an `Idempotency-Key` for expensive job-creation endpoints, or otherwise provide equivalent duplicate-request protection.
- Set explicit request and response schemas (Zod or the repository's existing validator). Reject unknown fields when they could change authorization or model behavior.
- Paginate lists. Do not return every imported post or evidence record in one response.
- Avoid leaking whether another user's resource ID exists; return the same not-found/forbidden behavior consistent with the security policy.
- Include request correlation IDs and safe error codes.
- Use signed short-lived object URLs only after authorization; do not expose storage credentials.

## 10. Security, privacy, and compliance requirements

1. **Authorization:** validate identity tokens in the API and enforce `user_id` ownership at every query/mutation boundary. If RLS is enabled, it is defense in depth, not a substitute for API authorization.
2. **Secrets:** store provider credentials in server-only environment variables or a managed secret store. Rotate credentials when exposed. Never log keys, bearer tokens, refresh tokens, or signed URLs.
3. **OAuth:** validate `state`, use PKCE where supported, minimize scopes, use HTTPS redirect URIs, handle expiry/revocation, and protect callback endpoints from replay.
4. **Token storage:** encrypt refresh/access tokens at rest, isolate encryption keys from the database, restrict decryption to the API/worker role, and avoid keeping unnecessary token copies.
5. **Uploads:** allowlist content types and extensions, set file-size/page limits, parse in a worker, defend against malformed files and decompression bombs, and optionally malware-scan documents when available.
6. **SSRF:** protect portfolio URL fetches against private IP ranges, localhost, cloud metadata endpoints, dangerous redirects, unsupported protocols, and DNS rebinding. Use outbound request timeouts and response-size limits.
7. **Prompt injection:** treat external content as untrusted evidence. Do not allow imported content to override instructions or invoke unauthorized tools.
8. **Model data minimization:** pass only evidence needed for the current target. Do not send provider credentials, unnecessary personal data, or unrelated account history to the model provider.
9. **Retention/deletion:** provide a documented deletion workflow. Delete or anonymize records and objects in all owned systems where legally/product-policy appropriate; account for backups and provider retention. Do not claim immediate physical erasure from backups if the storage system does not provide it.
10. **Provider terms:** validate allowed use, storage, display, and deletion rules for each social provider before launch. Store provenance and consent/version metadata.
11. **Rate and cost limits:** add per-user and global limits for imports, generations, exports, and model spend. Do not let repeated clicks create unlimited model jobs.
12. **Logging:** use structured logs with job ID, user ID hash/internal ID, step, model ID, latency, and error code. Redact CV text, prompts, tokens, and personal contact details by default.
13. **Database access:** migrations, restricted service roles, prepared statements/ORM parameterization, backups, and indexes. Never expose an unrestricted database service key to frontend code.
14. **Data correctness:** support the user in reviewing extracted facts and correcting mistakes. Clearly distinguish imported, inferred, and user-confirmed information.

## 11. Reliability, observability, and operations

### Logs and metrics

Capture at least:

- API request count, status codes, latency, and rate-limit events.
- Queue depth, wait time, active jobs, retries, and failures by job type.
- Job duration by step: import, parse, embedding, retrieval, draft, critique, revision, export.
- Provider API response status, throttles, token usage, timeouts, and model spend.
- Generation validation failure rate, average rubric score, revision count, and human edit rate when measurable.
- Import records processed, duplicate count, partial-import count, and permissions failures.
- Stale jobs, heartbeat expiry, re-enqueue counts, and notification delivery failures.

Do not include full private candidate content in observability tools by default. Establish alerts for sustained job failure, queue backlog, database errors, provider outages, unusual cost increases, and expiring secrets where detectable.

### Failure behavior

- **Provider unavailable:** retry safely, then mark the source/job appropriately; do not erase previous successful imports.
- **OAuth token expired:** mark `needs_reauth`, preserve the account connection record, and show a reconnect action.
- **LLM returns invalid JSON:** make a bounded format-repair attempt or retry with an adjusted request; record the failure and don't publish invalid content.
- **Critique fails:** do not loop indefinitely. Use configured fallback behavior and label evaluation as incomplete if quality checks could not run.
- **Redis outage:** preserve job state in PostgreSQL and reconcile/re-enqueue after recovery.
- **Worker crash:** detect stale heartbeat and safely retry from a checkpoint or restart idempotently.
- **Email failure:** retain completed job state and retry notification separately.
- **Export failure:** keep the canonical resume version and allow export retry without rerunning generation.

### Backups and migrations

Use version-controlled database migrations. Test migrations against a staging copy before production. Confirm backups and perform at least one restore drill. Keep schema rollback or forward-fix strategy for deployments that change data shape. Do not rely on database backups alone for uploaded files; confirm object-storage retention and recovery separately.

## 12. Testing strategy

### Unit tests

- Source normalization, content hashes, deduplication, evidence extraction, requirement parsing, ranking, rubric evaluation, schema validation, and state-transition logic.
- Authorization helpers, signed URL authorization, OAuth state/PKCE handling, and token redaction.
- Retry policy and idempotency logic.

### Integration tests

- API writes durable job record and enqueues exactly one logical job.
- Worker processes job through PostgreSQL and Redis and writes a retrievable result.
- Duplicate enqueue does not duplicate imported items or finalized versions.
- OAuth connection errors, revoked tokens, and rate limits lead to correct status.
- Model provider adapters validate output and record model metadata.
- Resume edits and export jobs do not accidentally trigger new AI generation.

### End-to-end tests

1. Sign in and create/update candidate profile.
2. Upload a CV, parse it asynchronously, review and correct evidence.
3. Connect an available source and complete asynchronous import.
4. Enter a job description, review requirements, and start generation.
5. Navigate away, return later, inspect status, and retrieve the result.
6. Verify that the generated resume contains only supported evidence and target-relevant content.
7. Edit a bullet, save a new version, export PDF/DOCX, and confirm output is readable.
8. Disconnect a source and verify reconnect/deletion behavior.
9. Simulate provider timeout, LLM malformed JSON, Redis outage, worker restart, and failed email.
10. Attempt cross-user access to every major resource and confirm denial.

### AI evaluation tests

Maintain a golden dataset and measure factuality, role relevance, requirement coverage, clarity, duplication, schema validity, formatting validity, latency, and cost. Compare candidate models on the same inputs. A prompt/model change is not accepted solely because sample output “sounds better”; compare results against the dataset and inspect regressions.

## 13. Implementation plan and acceptance criteria

### Phase 0 — Repository and provider audit

**Deliverables**
- `docs/architecture/IMPLEMENTATION_AUDIT.md`
- Updated environment-variable inventory (names only, no secret values)
- Confirmed provider access/capability table for GitHub, X, LinkedIn, model API, storage, database, and Redis
- Migration plan with current feature impact

**Acceptance criteria**
- Every deployed service and active provider is identified.
- There is one clearly identified database, one queue Redis endpoint, one API entry point, and a separate worker process.
- Email is removed from the candidate-source category.
- Restricted APIs are marked “not enabled” until verified against the active developer account and permitted scopes.
- Any importer that scrapes social profiles is identified, and removed or restricted to user-supplied content.

### Phase 1 — Backend/job foundation

**Deliverables**
- API service and worker startup commands
- Durable background job schema and migrations
- BullMQ queue wired to one Redis endpoint
- Job status API, SSE progress stream with polling fallback, and frontend status handling
- Idempotency, retries, heartbeat, reconciliation, and structured errors

**Acceptance criteria**
- A test job is persisted, enqueued, processed, and marked completed.
- A closed browser does not stop the job.
- A worker restart does not silently lose jobs.
- Duplicate requests do not create duplicate logical jobs.
- The frontend can re-open the job and get the final result.

### Phase 2 — Evidence ingestion foundation

**Deliverables**
- CV/portfolio/manual/job-description inputs
- At least one source connector that has verified permissions (GitHub is a likely candidate, but confirm repository/provider access)
- Normalized source records, candidate evidence, source provenance, deduplication, and review/edit controls
- Embedding generation, hybrid retrieval, and bounded graph expansion over `evidence_relations`

**Acceptance criteria**
- Import is paginated, resumable, deduplicated, and asynchronous.
- The user can review and correct extracted candidate facts.
- Relevant evidence can be retrieved for a supplied target role with traceable source IDs.
- Import failures don't destroy previous successful data.

### Phase 3 — Reliable resume AI engine

**Deliverables**
- Target requirement parser
- User focus input (free text, pinned and de-emphasized evidence)
- Optional bounded evidence-lookup tool
- Role-specific examples and rubric configuration
- Model-provider adapter and repeatable model evaluation
- Structured draft generator, deterministic validators, critique stage, bounded revision loop
- Versioned resume content and provenance

**Acceptance criteria**
- Every generated factual bullet has eligible supporting evidence or explicit user-provided content.
- Unsupported metrics are rejected or flagged.
- User focus changes emphasis but never produces unsupported claims.
- Critique returns actionable criterion-level issues.
- Revision loops are bounded and measured.
- The same test set can compare models/prompt versions objectively.

### Phase 4 — Export, notifications, privacy and polish

**Deliverables**
- PDF/DOCX export worker
- In-app notification center
- Optional CV review job (improvement suggestions for uploaded CVs)
- Completion and reauthorization notifications
- Account/source disconnect and deletion flow
- Monitoring, alerting, backup/restore validation, accessibility, and final design-system review

**Acceptance criteria**
- Export can be retried without rerunning generation.
- Email failure does not fail a completed resume job.
- Data access and deletion paths are tested across database and object storage.
- Relevant security, reliability, and AI quality tests pass in CI.

## 14. Definition of done

This architecture is implemented when:

- The backend clearly owns domain logic and exposes documented HTTPS APIs.
- Background workers process imports and generations without relying on long HTTP requests or open browser tabs.
- The database is the durable source of truth; Redis is a single queue endpoint and is recoverable.
- Candidate evidence is normalized, versioned where useful, traceable to sources, and searchable using hybrid retrieval.
- The generation request is target-aware, role-aware, evidence-backed, and schema-validated.
- A critique/revision stage improves output within a defined cap, and quality is measured on a repeatable dataset.
- Provider availability and limits are verified instead of assumed.
- User data, tokens, files, and generated documents are protected by authorization, secrets handling, retention rules, and tests.
- The existing design system is implemented consistently and loading/error/partial states are included.
- The README/architecture docs accurately describe what was actually deployed, not only the intended future state.

## 15. Final execution directive for the coding agent

Work in this order:

1. Audit the repo and deployment configuration; write the implementation gap report.
2. Identify the smallest path to one reliable API + one worker + one queue + one database.
3. Fix incorrect source/notification classification and remove duplicate infrastructure configuration.
4. Implement durable asynchronous job execution and status retrieval before expanding integrations.
5. Build candidate evidence ingestion and hybrid retrieval.
6. Implement generation, role-specific evaluation, critique, bounded revision, factuality validation, and output versioning.
7. Add/expand integrations only after permissions are verified; use graceful alternatives for unavailable providers.
8. Add exports, notifications, privacy/deletion workflows, observability, and full tests.

For each phase, make focused commits, add or update tests, update environment documentation, and report files changed, migrations added, tests run, provider assumptions, and remaining risks. Never mark an external integration “complete” based only on code compiling; verify it with real credentials in a non-production environment and document the scopes/access tier needed.

## Reference documentation to verify during implementation

Use the official, current documentation for the provider accounts actually configured in this project. The following pages are useful starting points, not a substitute for testing access in the active developer account:

1. Railway services and deployment model: https://docs.railway.com/services
2. Railway's API/worker/Redis/PostgreSQL asynchronous agent pattern: https://docs.railway.com/guides/ai-agent-workers
3. Supabase database overview and supported extensions including `pgvector`: https://supabase.com/docs/guides/database/overview
4. Supabase authentication architecture (relevant only if the existing project uses Supabase Auth): https://supabase.com/docs/guides/auth/architecture
5. Supabase Row Level Security guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
6. BullMQ with Upstash Redis (if Upstash is selected instead of Railway Redis): https://upstash.com/docs/redis/integrations/bullmq
7. GitHub REST API and rate limits: https://docs.github.com/en/rest/using-the-rest-api and https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
8. LinkedIn Profile API restrictions and permissions: https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api/
9. X Developer Platform access/pricing and endpoint access: https://developer.x.com/ and https://developer.x.com/apitools/api
10. Gemini API model catalog: https://ai.google.dev/gemini-api/docs/models
11. DeepSeek API/model documentation: https://api-docs.deepseek.com/quick_start/pricing/

Provider documentation, scopes, pricing, model availability, and API policies can change. Confirm current details before shipping or selecting a paid service.

## Appendix A — Reviewer feedback traceability

Each comment from the reviewer's voice note, mapped to the section that answers it.

| # | Reviewer comment | Where addressed | Status |
|---|---|---|---|
| 1 | An email provider was listed as a candidate source | §6.1, §2 (Notifications), Phase 0 acceptance | Addressed |
| 2 | Generation pipeline was synchronous | §7, §9 (`202` + job ID), §7.4 (SSE), §7.5 (email) | Addressed |
| 3 | No clear backend; workers cannot work without one | §2, §3, §4.2, §4.3 | Addressed: dedicated API plus separate worker |
| 4 | Redis on Railway and Upstash both mentioned | §2 (One-provider rule) | Addressed. **Decision needed:** pick one endpoint (Railway Redis is the default) |
| 5 | Supabase does auth, realtime, and triggers; use it as a database | §2 (Supabase boundary) | Addressed for Realtime, triggers, and Edge Functions. **Decision needed:** Supabase Auth stays as identity issuer only; removing it is a separate migration |
| 6 | Account fetching should run in the background | §6.2, §7 | Addressed |
| 7 | Fetch all posts, not about 50; store them in the database | §6.4 | Addressed |
| 8 | Do not send every post to the LLM; rank by relevance to the job | §8.1, §8.2 Stage 3 | Addressed |
| 9 | Index in a graph database; use vector search from the job description | §5.4, §5.5, §8.2 Stage 3 | Addressed in PostgreSQL (`pgvector` + `evidence_relations` + bounded graph expansion). **Deliberate deviation:** no separate graph database until measured retrieval quality shows a need. Reviewer to confirm |
| 10 | User can specify what they want to see in the resume | §8.2 Stages 0 and 3, §9 | Added in Revision 2 |
| 11 | Give the AI examples of good resumes per role | §5.9, §8.2 Stages 4 and 7 | Addressed; annotated bad examples added |
| 12 | AI engine is too basic; improve tone; test it heavily | §8.2, §8.5, §8.7, §12 | Strengthened: tone profiles, judge calibration, golden dataset |
| 13 | Add portfolios and CVs as sources; tell users what to improve | §6.3, Phase 2, Phase 4 | Sources addressed; CV feedback added as an optional later job |
| 14 | Messages and quality metrics should differ by role | §5.9, §8.5 | Addressed |
| 15 | Use a stronger model (DeepSeek or a Gemini Pro-tier model) | §8.6 | Addressed as benchmark-then-choose, with model tiering and a data-handling check. **Decision needed:** default provider after the benchmark |
| 16 | Generate, critique, revise; allow tools to fetch more information | §8.2 Stages 5, 7, 8 | Loop already present; bounded read-only evidence lookup added |
| 17 | Verify that X and LinkedIn APIs are actually available | §6.3, Phase 0 | **Open:** needs checking in the active developer accounts |
| 18 | Implementation should follow the design-system guideline | Phase 4 (final design-system review) | Out of scope for this document; reviewer will judge against the separate design-system document |

## Appendix B — Known current-state gaps (from the public README)

Observed in the README at github.com/0biken/tracck. These are **not verified against the code**; confirm each during the Phase 0 audit.

| # | README shows | Conflicts with | Suggested action |
|---|---|---|---|
| 1 | Next.js API routes on Vercel handle OAuth callbacks and job creation; workers run on Railway | §2, §4.2: dedicated API service | Stand up the API as its own service; keep Vercel for the frontend only |
| 2 | Upstash Redis in the architecture while workers are on Railway | §2: one-provider rule | Choose one Redis endpoint and remove the other configuration |
| 3 | A database webhook on `raw_posts` INSERT enqueues AI extraction (migration 008) | §2: Supabase boundary | Remove the trigger; the API and worker own enqueueing |
| 4 | GitHub ingestion covers only the last 90 days; extraction is enqueued in batches of 50 | §6.4 | Backfill full history through a paginated, resumable import |
| 5 | Every raw post is classified by Gemini; bullets are generated at ingestion, before a target role is known | §8.1, §6.4 | Extract evidence at ingestion (cost-tiered); generate bullets per target role at generation time |
| 6 | `scrape-profile` and Firecrawl extractors for LinkedIn, Instagram, and Behance | §1 non-goals, §6.3, Phase 0 | Remove social-profile scraping (it likely conflicts with those platforms' terms). Keep portfolio fetch with SSRF protection, paste input, and user-exported archives |
| 7 | LinkedIn and X OAuth variables listed, while the platform table says paste-only | §6.3 | Remove until access is verified in the developer accounts |
| 8 | Model hard-coded as `gemini-flash-latest` | §8.6 | Introduce the provider adapter and per-run model IDs |
| 9 | `confidence = model_confidence x source_trust_multiplier` | §5.4 | Keep only as a ranking heuristic; truth comes from `verification_status` |
| 10 | Setup runs `node workers/index.ts` on a TypeScript file | Operations | Add a build step or a TypeScript runner for workers |
