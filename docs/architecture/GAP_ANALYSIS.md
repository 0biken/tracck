# Tracck — Gap analysis

**Date:** 2026-10-12
**Targets:** [Technical Architecture v2](./Tracck_Technical_Architecture_v2.md) and the [design system](../design/tracck-design-system.html)
**Starting point:** the [Phase 0 audit](./IMPLEMENTATION_AUDIT.md)

Status: **Done** is built and checked. **Partly** names what is missing. **Open** is not started. **Blocked** needs an account or key that is not in the repository.

Size of what remains: S = under a day, M = days, L = a week or more.

## Decisions taken

| Question | Decision |
|---|---|
| Which codebase | This repository. The routes and scraper code the two documents mention were never built here |
| Database | Empty, so the v2 schema is written fresh. The v1 SQL is archived in `docs/archive/v1/` |
| API location | A dedicated API service (`services/api`), next to the worker (`services/worker`), sharing `packages/core` |
| Social sources | No profile scraping. Official APIs where access is verified (GitHub first), plus CV upload, LinkedIn data export, portfolio URL and manual entry |
| Redis (assumed) | One endpoint, Railway Redis, as v2 defaults |
| Object storage (assumed) | Supabase Storage, private buckets |

## A. Defects in the starting scaffold

| Gap | Status |
|---|---|
| Sign-in redirected to a page that did not exist | Done |
| Auth errors were never shown | Done. Errors travel as a short code and render as an alert |
| Signup name was lost (`name` vs `full_name`) | Done |
| Signup ignored the email-confirmation case | Done. Shows "Check your email" |
| ESLint could not start | Done. The lockfile was out of sync and has been regenerated |
| No `.env.example`; package named `temp_dir` | Done |
| `middleware.ts` used the convention Next.js 16 renames | Done. Now `src/proxy.ts` |

## B. Interface against the design system

| Design system requires | Status | Remaining |
|---|---|---|
| Token file, light and dark themes, Tailwind v4 mapping | Done | |
| Bricolage Grotesque and Instrument Sans through `next/font` | Done | |
| No gradients, glows or entrance animation | Done | |
| Button, field, badge, alert, skeleton, empty state | Done | |
| Segmented control, dialog, toast, checkbox, upload drop zone | Open | M. Build each with the first screen that needs it |
| App shell: five destinations, bottom tabs under 1024px, sidebar above | Done | Review count badge waits for real entries |
| Theme choice control (Light, Dark, System) | Open | S. The tokens already honor `data-theme`; nothing sets it yet |
| Job progress pattern | Partly | Built and wired to the API. Not yet exercised against a live API (see Verification) |
| Onboarding sequence with consent step | Open | M |
| Entry review card, source list, role coverage and focus, resume versions | Open | L. Each needs its backend first |
| Resume document style | Open | M. Belongs with export |
| WCAG 2.2 AA on existing screens | Partly | Labels, focus ring, error alerts, touch sizes and reduced motion are in. No audit with a screen reader has been done |
| Glossary and step labels | Done | Step and status labels live in `packages/core/src/labels.ts` |

## C. Backend against architecture v2

| v2 requires | Section | Status | Remaining |
|---|---|---|---|
| API service: auth, validation, error envelope with correlation ID | §4.2, §9 | Done | Per-user rate limits |
| Worker service with start command | §4.3 | Done | Runs TypeScript through `tsx`; no separate compile step |
| BullMQ on one Redis | §2, §4.5 | Partly | Code is written. **Blocked** on a Redis to run it against |
| Durable jobs, idempotency, heartbeat, reconciler | §5.8, §7.2, §7.3 | Done | |
| Job status, SSE stream, polling fallback, cancel, retry | §7.4, §9 | Done | |
| v2 schema with `pgvector` | §5 | Done | `target_opportunities` has no embedding column yet. Evidence embeddings have no ANN index until the embedding model fixes the dimension |
| RLS without the v1 holes | §10 | Done | Browser access is read-only on own rows. Token and audit tables are server-only |
| Private object storage, signed URLs | §4.6 | Blocked | Bucket |
| CV upload and parsing, manual entry, job description input, portfolio fetch | §6.3 | Open | L |
| Source adapter interface, capability registry, GitHub connector | §6.3 | Blocked | GitHub app registration |
| Tiered extraction, embeddings, hybrid retrieval, graph expansion | §6.4, §8.2 | Blocked | Model keys |
| AI provider adapter, model tiering, data-handling review | §8.6 | Blocked | Keys and the review |
| Generation pipeline, user focus, evidence lookup tool | §8.2 | Open | L |
| Rubrics, tone profiles, examples, golden test set | §5.9, §8.5, §8.7 | Open | L. Tables exist, content does not |
| PDF and DOCX export | §8.2 Stage 10 | Open | M |
| Notifications, data deletion | §7.5, §10.9 | Open | M. Email is blocked on a provider |
| Metrics and alerts | §11 | Partly | Services log structured JSON. No metrics or alerts |
| Tests | §12 | Partly | 46 unit and integration tests. No end-to-end or AI evaluation tests |

## D. Documentation

| Gap | Status |
|---|---|
| v1 design docs and SQL described an abandoned design | Done. Moved to `docs/archive/v1/` with a notice |
| README described features that do not exist | Done. Rewritten to match the repository |

## Where the build departs from v2, and why

- **Three extra job transitions.** v2 §7.1 lists eight. Cancelling a waiting job, retrying a failed job and resuming after `needs_user_action` are described in the same section without a transition, so `retry_wait → cancelled`, `failed → queued` and `needs_user_action → queued | cancelled` were added. See `packages/core/src/jobs.ts`.
- **A `diagnostic` job type.** Not in v2. It does nothing and exists to prove the path from API to worker. Its route is off unless `ENABLE_DIAGNOSTIC_JOBS=true`.
- **Tokens in their own table.** v2 allows token fields on `source_connections`. They are in `source_connection_secrets` so that no browser-facing policy can ever select them.
- **Embeddings in their own table.** v2 allows either. A separate table lets the embedding model change without rewriting evidence.
- **Retries are decided in PostgreSQL, not by BullMQ.** Each queue entry runs once. The worker writes `retry_wait` and enqueues the next attempt itself, which keeps the database as the single source of truth.

## Verification

Checked on 2026-10-12:

- `npm run lint`, `npm run typecheck` and `npm run build` pass.
- `npm test` passes (46 tests). The migrations are applied to an in-process PostgreSQL with `pgvector`, so the schema, RLS policies, job store, worker runner, reconciler and API routes are tested against real SQL.
- In a browser: sign-in and signup render in light and dark; a failed sign-in shows its error; the five shell pages render at 375px and 1280px with no horizontal scroll; unauthenticated visits redirect to sign-in.

Not checked, because nothing was available to run it against:

- A real sign-in. It needs a Supabase project URL and key.
- The migrations on a real Supabase project. The test database stubs the `auth` schema and roles.
- The queue end to end. No Redis was running, so BullMQ, pub/sub fan-out and the live job-progress screen are covered only through fakes.
