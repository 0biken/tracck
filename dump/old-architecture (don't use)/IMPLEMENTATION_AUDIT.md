# Tracck — Implementation Audit (Phase 0)

**Date:** 2026-10-12
**Audited against:** [Tracck_Technical_Architecture_v2.md](./Tracck_Technical_Architecture_v2.md)
**Scope:** the local repository at commit `01f077d` (remote `github.com/0biken/traack`).

> **Update, same day.** This audit describes the repository as it was found. Decisions B1, B3, B4 and B10 below have since been made, the defects in §1 are fixed, and the v1 files it cites now live in `docs/archive/v1/`. See [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) for current status.

**What this audit could and could not check.** Everything below about code, migrations and docs was read directly from the repository, and the app was built with `next build`. Nothing about deployed services could be checked: the repo contains no deployment config, no `.env` files and no Supabase project config, so the state of Vercel, Railway, Supabase, Redis and every provider account is **unknown** and listed under blockers (§5).

---

## Summary

The repository is a Next.js scaffold with email/password login and signup. There is no API, no worker, no queue, no AI code, no source connector and no resume generation. The v1 design docs and nine SQL files describe a system that was never built.

This makes the migration cheap. Almost every conflict the v2 document warns about exists only on paper, so the work is to build the v2 design directly and retire the v1 docs, not to migrate running code. The two things that need care are the existing auth flow, which works and should be kept, and the SQL files, which may or may not have been applied to a live database.

---

## 1. Current state

| Area | What exists | Evidence |
|---|---|---|
| Frontend framework | Next.js 16.2.9 (App Router, Turbopack), React 19.2.4, TypeScript 5, Tailwind 4 installed | `package.json` |
| Pages | `/` (unmodified create-next-app template), `/login`, `/signup` | `src/app/` |
| Backend entry points | None. No `route.ts` files. Two server actions, `login` and `signup` | `src/app/auth/actions.ts` |
| Auth | Supabase Auth, email/password, cookie sessions through `@supabase/ssr`. Session refresh and redirect-to-login in middleware | `src/utils/supabase/*`, `middleware.ts` |
| Database | Nine SQL files kept under `docs/`, not in a migrations folder. No Supabase CLI config. Whether they were applied anywhere is unknown | `docs/001…009_*.sql` |
| Object storage | None in code. v1 docs plan Supabase Storage buckets | `docs/system-design.md` §3.3 |
| Queue / Redis | None. `bullmq` and any Redis client are not installed | `package.json` |
| Worker process | One line: `console.log("Background workers starting up...")`. No script runs it | `workers/index.ts` |
| AI SDK / provider | None installed. v1 docs name Gemini `gemini-flash-latest` | `docs/env-secrets.md` §3.3 |
| Email | None installed. v1 docs name Resend | `docs/env-secrets.md` §2.8 |
| Deployment config | None (`vercel.json`, `railway.*`, `Dockerfile`, `Procfile` all absent) | repo root |
| Env files | None. `.env.example` is referenced by the README but does not exist | repo root |
| Tests | None. No test runner installed | `package.json` |
| Design system | Now in the repo at `docs/design/tracck-design-system.html`. Not implemented | see §3.4 |

### Build and tooling results

- `next build` succeeds. Routes: `/`, `/login`, `/signup`. Middleware is picked up.
- `eslint` fails to start: `Cannot find module 'es-abstract/2025/ToString'`. The install in `node_modules` is broken, so lint has not been running. A clean reinstall should fix it.
- Next.js picks the wrong workspace root because a stray `C:\Users\Sandy Star\Downloads\package-lock.json` sits above the project. This is local to this machine.
- `package.json` still has the scaffold name `temp_dir`.
- The README says Next.js 14; the code is Next.js 16. `middleware.ts` uses the convention Next.js 16 renames to `proxy`.

### Defects in what exists

| # | Defect | Where | Effect |
|---|---|---|---|
| D1 | Login and signup redirect to `/dashboard`, which does not exist | `src/app/auth/actions.ts:27,56` | Every successful sign-in lands on a 404 |
| D2 | Auth errors are put in `?error=` but neither page reads it. The `.error-message` style is unused | `src/app/login/page.tsx`, `src/app/signup/page.tsx` | A wrong password reloads the form with no message |
| D3 | Signup stores the name as metadata key `name`; the database trigger reads `full_name` | `actions.ts:46` vs `docs/008_functions_and_triggers.sql:42` | The user's name is replaced by the email prefix |
| D4 | Signup always redirects to `/dashboard`, even when Supabase requires email confirmation and returns no session | `actions.ts:56` | User is bounced back to login with no explanation |
| D5 | `globals.css` does not import Tailwind, but the home page uses Tailwind classes | `src/app/globals.css`, `src/app/page.tsx` | Home page renders unstyled |

---

## 2. What exists versus what v2 requires

| v2 requirement | Section | Status | Gap |
|---|---|---|---|
| Dedicated HTTPS API service | §2, §4.2 | Missing | No API of any kind. Decision needed on where it lives (§4, step 2) |
| Separate always-on worker | §4.3 | Stub | One log line. No handlers, no build step, no start script |
| BullMQ on one Redis endpoint | §2, §4.5 | Missing | Nothing installed or configured |
| Durable `background_jobs` + `generation_runs` | §5.8 | Missing | No job table in any migration |
| Job status API, SSE stream, polling fallback | §7.4, §9 | Missing | |
| Idempotency, heartbeat, reconciliation | §7.2, §7.3 | Missing | |
| `profiles` | §5.1 | Partial | `users` table has `name`, `role_tags`, `avatar_url` only |
| `source_connections` | §5.2 | Partial | `connected_accounts` exists but lacks `provider_account_id`, consent version, `revoked_at`, error code, and stores tokens in plain `TEXT` columns |
| `source_items` | §5.3 | Partial | `raw_posts` covers social posts only. No uploads, portfolio, manual entries, job descriptions, content hash or object key |
| `candidate_evidence`, `evidence_sources`, `evidence_relations` | §5.4, §5.5 | Missing | `accomplishments` is the nearest table but it stores a finished bullet per post, with no verification status and no multi-source support |
| `pgvector`, embeddings, hybrid retrieval | §4.4, §8.2 Stage 3 | Missing | Extension not enabled in any migration |
| `target_opportunities` (job descriptions) | §5.6 | Missing | v1 has no concept of a target role beyond `role_tags` |
| `resume_documents` + `resume_versions` with structured JSON | §5.7 | Partial | `resumes` stores file URLs and a score, not canonical content |
| `resume_examples`, `role_rubrics` | §5.9 | Missing | |
| `notifications`, `audit_events` | §5.10 | Missing | |
| Private object storage with signed URLs | §4.6 | Missing | Planned only |
| CV upload, portfolio fetch, manual entry, job description input | §6.3 | Missing | v1 has a LinkedIn file import endpoint on paper only |
| Source adapter interface + capability registry | §6.3 | Missing | |
| AI provider adapter, model tiering, per-run model IDs | §8.6 | Missing | |
| Generation pipeline (draft, validate, critique, revise) | §8.2 | Missing | |
| User focus and pinned evidence | §8.2 Stages 0, 3 | Missing | |
| Role rubrics, tone profiles, golden test set | §8.5, §8.7 | Missing | |
| PDF/DOCX export as its own job | §8.2 Stage 10 | Missing | |
| Error envelope with `correlationId` | §9 | Differs | v1 envelope is `{ success, error: { code, message, details } }` with no correlation ID |
| Data deletion workflow | §10.9 | Missing | |
| Structured logging, metrics, alerts | §11 | Missing | |
| Unit, integration, end-to-end, AI evaluation tests | §12 | Missing | |

---

## 3. Duplicate or conflicting infrastructure

### 3.1 Appendix B, checked against this repository

Appendix B was written from the README at `github.com/0biken/tracck`. This repository's remote is `github.com/0biken/traack`, and its README differs (for example it lists Figma and has no scraper section). Each item was re-checked here.

| # | Appendix B claim | Found in this repo | Action |
|---|---|---|---|
| 1 | Next.js API routes on Vercel handle OAuth and job creation | **Docs only.** No API routes exist | Nothing to move. Build the API as v2 describes |
| 2 | Upstash Redis while workers are on Railway | **Docs only.** v1 specifies Upstash twice: REST for rate limiting and Redis protocol for BullMQ | Pick one endpoint before any Redis code is written |
| 3 | DB webhook on `raw_posts` INSERT enqueues AI extraction | **Present in SQL, described three different ways.** `008` uses `pg_notify('new_raw_posts')`; `env-secrets.md` §4.3 configures an HTTP webhook to Railway; `api-design.md` §4.9 puts the receiver under the Vercel base URL | Drop `notify_new_raw_post` and its trigger. Remove the webhook from the docs |
| 4 | GitHub fetch limited to 90 days; batches of 50 | **Docs only** (`system-design.md` §4.1, §4.2; `AI_BATCH_SIZE=50`) | Do not carry forward |
| 5 | Every post classified by Gemini; bullets generated at ingestion | **Docs and schema.** `accomplishments.bullet_text` is `NOT NULL` and tied to one `raw_post_id` | Replace with `candidate_evidence`; generate bullets per target role |
| 6 | `scrape-profile` and Firecrawl extractors | **Not found.** No scraper code, dependency or doc section. The only trace is `behance` and `instagram` in the `connected_accounts` platform constraint and the `Platform` type | Remove those two values. No scraper to delete |
| 7 | LinkedIn and X OAuth variables listed while LinkedIn is paste-only | **Confirmed in docs.** `TWITTER_*` are marked required; `LINKEDIN_*` and `FIGMA_*` are marked Phase 2 | Remove from the env inventory until access is verified |
| 8 | Model hard-coded as `gemini-flash-latest` | **Docs only.** No such file exists yet | Build the adapter from the start |
| 9 | `confidence = model_confidence x source_trust_multiplier` | **Not found.** The schema has a plain `confidence_score`, and status is derived from it (`< 0.7` becomes `low_confidence`) | Keep confidence as a ranking signal; add `verification_status` |
| 10 | Setup runs `node workers/index.ts` | **Not in this README**, but the underlying problem is real: no script, build step or TypeScript runner exists for the worker | Add a worker build and start command |

### 3.2 Email modelled as a source

Not found. Resend appears only as a notification channel in the v1 docs, and no source selector exists yet. The rule still needs enforcing when the source list is built.

### 3.3 Security problems in the SQL files

These matter only if the migrations were applied, but they should not be carried into the new schema.

| # | Problem | Where | Risk |
|---|---|---|---|
| S1 | `connected_accounts_all_own` is `FOR ALL`, so a signed-in browser using the anon key can `SELECT` its own `access_token` and `refresh_token` | `docs/009_rls_policies.sql:21-23` | Provider tokens reach the browser, which v2 §0 forbids. Encryption is a comment, not a constraint |
| S2 | `get_confirmed_bullet_count(p_user_id)` and `get_latest_resume(p_user_id)` are `SECURITY DEFINER` and take any user ID | `docs/008_functions_and_triggers.sql:124-132` | Any signed-in user can read another user's latest resume row, bypassing RLS |
| S3 | `accomplishments_update_own` lets a user update every column, including `confidence_score` | `docs/009_rls_policies.sql:34-36` | Low. Users can alter fields meant to be system-owned |
| S4 | `handle_new_auth_user` is `SECURITY DEFINER` with no fixed `search_path` | `docs/008_functions_and_triggers.sql:51` | Low. Standard hardening gap |
| S5 | `set_resume_version` computes `MAX(version) + 1` without locking | `docs/008_functions_and_triggers.sql:89` | Two concurrent builds collide on the unique constraint |

### 3.4 Design system conflict

The login and signup styling contradicts the design system on most points, and the design system's own checklist lists these as patterns that fail review.

| Design system | Current `globals.css` |
|---|---|
| Fonts: Bricolage Grotesque and Instrument Sans, and only those two | Outfit, loaded from a Google Fonts `@import` |
| Accent `#2447D6` (ballpoint blue), light theme first with a dark theme | Violet `#8B5CF6`, dark only |
| No gradients, glows or decorative entrance animation | Gradient text and buttons, glow shadow, blurred floating orbs |
| Tokens only, no hex in components | Hex and `rgba` values throughout |
| No placeholder-only cues; error summary after a failed submit | No error display at all (D2) |

Recommendation: rebuild the two auth pages on the design-system tokens when the app shell is built, and remove the current stylesheet. It is about 200 lines and nothing else depends on it.

### 3.5 Documentation that contradicts v2

`docs/system-design.md`, `docs/api-design.md`, `docs/database-migrations.md`, `docs/env-secrets.md` and the README all describe the v1 design. Leaving them next to v2 will mislead the next reader. Mark each as superseded now and rewrite them as the phases land.

---

## 4. Migration plan

There is no working user flow beyond sign-in, and no known production data, so this is a build plan with one preservation rule: **keep Supabase Auth and the cookie session flow as they are.**

**Step 0. Repair the baseline** (small, no design decisions)
- Reinstall dependencies so lint runs. Rename the package. Add `.env.example`.
- Fix D1 to D4: add a placeholder authenticated page, show auth errors, align the `name` metadata key, handle the email-confirmation case.
- Mark the v1 docs as superseded.

**Step 1. Confirm the facts in §5.** Whether a Supabase project exists and has the v1 schema decides between two paths:
- *Not applied:* discard the nine SQL files and write the v2 schema fresh under `supabase/migrations/`.
- *Applied:* write forward migrations. Keep `users` (rename or view as `profiles`), evolve `connected_accounts` into `source_connections`, copy `raw_posts` into `source_items`, convert `accomplishments` into unverified `candidate_evidence`, and drop the `raw_posts` trigger and the two `SECURITY DEFINER` helpers. Either way, fix S1 by removing browser access to token columns.

**Step 2. Decide where the API lives.** v2 asks for a dedicated API service on Railway. Since no API exists, the smallest route that meets it is one TypeScript codebase with three entry points: the Next.js frontend, an `api` service, and a `worker` service, with the API and worker sharing job handlers and types. The alternative, Next.js route handlers on Vercel, is less work at first but cannot hold SSE streams reliably and is what the reviewer objected to. Recommended: the dedicated service.

**Step 3. Phase 1 of v2.** `background_jobs` table, BullMQ on the one chosen Redis, a test job end to end, job status endpoint, SSE with polling fallback, idempotency, heartbeat and reconciler.

**Step 4 onward.** Phases 2 to 4 as written in v2 §13.

---

## 5. Blockers and open decisions

None of these can be answered from the repository.

| # | Question | Why it blocks |
|---|---|---|
| B1 | Does a Supabase project exist, and were the nine SQL files applied to it? Is there any real user data? | Chooses the migration path in step 1 |
| B2 | Is anything deployed on Vercel or Railway today? | v2 Phase 0 requires every deployed service to be identified |
| B3 | Which Redis: Railway or Upstash? Is either provisioned? | One-provider rule. Railway is the v2 default |
| B4 | Dedicated API service, or Next.js route handlers? | Shapes the repo layout before any backend code is written |
| B5 | Is a GitHub OAuth App or GitHub App registered? Which scopes? | First real connector |
| B6 | X developer account tier and LinkedIn product access | v2 marks both "not enabled" until verified. LinkedIn is expected to stay upload or paste only |
| B7 | Which model providers have keys, and has the data-handling review in v2 §8.6 been done? | No candidate content may be sent until it is |
| B8 | Object storage: Supabase Storage or another S3-compatible bucket? | CV uploads and exports |
| B9 | Email provider account and verified sending domain | Notifications in Phase 4 |
| B10 | Scraping. An earlier plan was to use web scrapers; v2 rules out scraping social profiles | Needs an explicit decision so the connector work has one direction |

---

## Appendix 1 — Provider capability table

Status reflects what the repository shows. Nothing here has been verified against a live account.

| Provider | Role | In code | Access verified | Status |
|---|---|---|---|---|
| Supabase Postgres | Database | SQL files only | No | Unknown (B1) |
| Supabase Auth | Identity | Yes, working locally if env is set | No | Keep |
| Redis | Queue | No | No | Not provisioned as far as the repo shows (B3) |
| Object storage | Files | No | No | Undecided (B8) |
| GitHub | Evidence source | No | No | Not enabled (B5) |
| X | Evidence source | No | No | Not enabled (B6) |
| LinkedIn | Evidence source | No | No | Not enabled; plan for upload or paste (B6) |
| Figma | Evidence source | No | No | In v1 docs only; not mentioned in v2. Drop unless requested |
| Gemini / DeepSeek / other | AI | No | No | Not enabled until benchmark and data review (B7) |
| Resend | Notifications | No | No | Not enabled (B9) |

## Appendix 2 — Environment variable inventory (names only)

**Used by code today**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Named in v1 docs, not used by any code**

- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Redis: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL`
- App: `NEXT_PUBLIC_APP_URL`, `ADMIN_API_KEY`, `OAUTH_STATE_SECRET`, `ENCRYPTION_KEY`
- OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- AI: `GEMINI_API_KEY`
- Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- Worker: `SOCIAL_FETCH_CRON`, `AI_BATCH_SIZE`, `AI_CONFIDENCE_THRESHOLD`, `WORKER_LOG_LEVEL`

**Expected to change under v2**

- Remove: both `UPSTASH_REDIS_REST_*` (unless Upstash is the chosen single endpoint), `ADMIN_API_KEY` (it exists for the webhook and cron trigger routes that v2 removes), `AI_BATCH_SIZE`, `TWITTER_*`, `LINKEDIN_*`, `FIGMA_*` until access is verified.
- Add: model provider and model IDs per stage, embedding model ID, object storage credentials and bucket, per-queue worker concurrency, API base URL for the frontend.
