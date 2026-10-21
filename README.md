# Tracck

Tracck builds resumes from work a person can show. It keeps a record of entries drawn from their sources, and every claim on a resume traces back to an entry and the passage that supports it.

**Status: early build.** Sign-in, the app shell and the background-job foundation exist. Importing sources, the AI engine and resume export are not built yet. See the [gap analysis](./docs/architecture/GAP_ANALYSIS.md) for exactly what is done.

## What is in the repository

| Path | What it is |
|---|---|
| `frontend/` | Next.js 16 app: marketing and pricing, sign-in and signup, onboarding, the product screens (Home, Resumes and the editor, Career Graph, Evidence library, Sources, CV feedback, Settings) and the organisation API screens. Product screens run on sample data in `src/lib/mock/` until the API has endpoints for them |
| `backend/` | NestJS app: the HTTPS API and the background jobs (BullMQ), in one process. Verifies Supabase tokens, creates jobs, serves job status and a server-sent event stream, runs jobs with retries, and recovers lost ones. Modules: `config`, `connections`, `auth`, `jobs`, `health`. Job handlers live in `backend/src/jobs/handlers/` |
| `shared/` | Source-only code used by both apps: job states, the PostgreSQL job store, queue contract, labels, error codes |
| `supabase/migrations/` | Database schema and row-level security |
| `docs/` | Architecture, design system, audit and gap analysis |

The frontend and backend are separate apps. Each has its own `package.json`, lockfile and `node_modules`, and none of them depends on a root install. `shared/` is linked into each one as a local dependency (`"@tracck/shared": "file:../shared"`). It has no `node_modules` of its own: each app compiles it, 

PostgreSQL is the source of truth for job state. Redis only carries job IDs from the API to the job runner.

## Documentation

- [Technical Architecture v2](./docs/architecture/Tracck_Technical_Architecture_v2.md): the target architecture and phased plan.
- [Design system](./docs/design/tracck-design-system.html): tokens, components, patterns and the review checklist.
- [Gap analysis](./docs/architecture/GAP_ANALYSIS.md): what is built, what is open, what is blocked.
- [Implementation audit](./docs/architecture/IMPLEMENTATION_AUDIT.md): the Phase 0 audit of the starting point.
- [`docs/archive/v1/`](./docs/archive/v1/): the superseded first design.

## Local setup

Requires Node.js 22.12 or later (the test runner needs it; the frontend alone runs on 20.9+).

Install each app on its own:

```bash
cd frontend && npm install
```

```bash
cd backend && npm install
```

Each app has its own `.env.example`. Copy it next to itself and fill it in: `frontend/.env.local` and `backend/.env`. The frontend needs the two `NEXT_PUBLIC_SUPABASE_*` values to sign in. Without them the sign-in page loads and explains what is missing. The backend needs `DATABASE_URL` and `REDIS_URL`.

Apply the files in `supabase/migrations/` to your Supabase project in order, with the Supabase CLI or the SQL editor.

Run each app in its own terminal. The backend serves the API and runs background jobs:

```bash
cd frontend && npm run dev
```

```bash
cd backend && npm run dev
```

To check the job path end to end, set `ENABLE_DIAGNOSTIC_JOBS=true` for the backend and `NEXT_PUBLIC_API_URL` for the frontend. The Overview page then shows a "Start test job" button in development.

## Checks

Run these inside each app folder. `backend` has `typecheck` and `test`; `frontend` has `lint`, `typecheck` and `build`.

```bash
npm run typecheck
```

```bash
npm test
```

The tests need no database or Redis. They run the real migrations against an in-process PostgreSQL.

## License

MIT License.
