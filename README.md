# Tracck

Tracck builds resumes from work a person can show. It keeps a record of entries drawn from their sources, and every claim on a resume traces back to an entry and the passage that supports it.

**Status: early build.** Sign-in, the app shell and the background-job foundation exist. Importing sources, the AI engine and resume export are not built yet. See the [gap analysis](./docs/architecture/GAP_ANALYSIS.md) for exactly what is done.

## What is in the repository

| Path | What it is |
|---|---|
| `src/` | Next.js 16 frontend: sign-in, signup, and the app shell (Overview, Sources, Review, Roles, Resumes) |
| `services/api/` | HTTPS API (Fastify). Verifies Supabase tokens, creates jobs, serves job status and a server-sent event stream |
| `services/worker/` | Background worker (BullMQ). Runs jobs, retries with backoff, recovers lost jobs |
| `packages/core/` | Code shared by all three: job states, the PostgreSQL job store, queue contract, labels, error codes |
| `supabase/migrations/` | Database schema and row-level security |
| `docs/` | Architecture, design system, audit and gap analysis |

PostgreSQL is the source of truth for job state. Redis only carries job IDs between the API and the worker.

## Documentation

- [Technical Architecture v2](./docs/architecture/Tracck_Technical_Architecture_v2.md): the target architecture and phased plan.
- [Design system](./docs/design/tracck-design-system.html): tokens, components, patterns and the review checklist.
- [Gap analysis](./docs/architecture/GAP_ANALYSIS.md): what is built, what is open, what is blocked.
- [Implementation audit](./docs/architecture/IMPLEMENTATION_AUDIT.md): the Phase 0 audit of the starting point.
- [`docs/archive/v1/`](./docs/archive/v1/): the superseded first design.

## Local setup

Requires Node.js 20 or later.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local`. The frontend needs the two `NEXT_PUBLIC_SUPABASE_*` values to sign in. Without them the sign-in page loads and explains what is missing.

Apply the files in `supabase/migrations/` to your Supabase project in order, with the Supabase CLI or the SQL editor.

Run the frontend:

```bash
npm run dev
```

Run the API and the worker, each in its own terminal. Both need `DATABASE_URL` and `REDIS_URL` in their environment:

```bash
npm run dev:api
```

```bash
npm run dev:worker
```

To check the job path end to end, set `ENABLE_DIAGNOSTIC_JOBS=true` for the API and `NEXT_PUBLIC_API_URL` for the frontend. The Overview page then shows a "Start test job" button in development.

## Checks

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

The tests need no database or Redis. They run the real migrations against an in-process PostgreSQL.

## License

MIT License.
