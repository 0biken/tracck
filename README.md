# Tracck

Tracck builds resumes from work a person can show. It keeps a record of entries drawn from their sources, and every claim on a resume traces back to an entry and the passage that supports it.

**Status:** the user-facing app is built end to end, but has not yet been run against real Supabase, GitHub, Paystack, Resend or Storage accounts. See [docs/GAP_ANALYSIS.md](./docs/GAP_ANALYSIS.md) for exactly what is verified and what is not.

## What is in the repository

| Path | What it is |
|---|---|
| `frontend/` | Next.js 16 app: marketing and pricing, sign-in, onboarding, and the product screens (Home, Sources, Evidence, Career Graph, CV feedback, Resumes and the editor, Settings). Calls the backend API |
| `backend/` | NestJS app: the HTTPS API and the background jobs (BullMQ) in one process. Modules are in `backend/src/`, one folder per area |
| `shared/` | Code used by both apps: API contracts, job states and the job store, error codes. Source only, with no `node_modules` of its own |
| `docs/` | Product requirements (architecture in `docs/prd/03-architecture.md`), gap analysis and the design system |

The frontend and backend are separate apps. Each has its own `package.json`, lockfile and `node_modules`. `shared/` is linked into each one as a local dependency (`"@tracck/shared": "file:../shared"`).

PostgreSQL is the source of truth for job state. Redis only carries job IDs from the API to the job runner.

## Documentation

- [Product requirements](./docs/prd/index.md): overview, architecture (`docs/prd/03-architecture.md`), requirements and open questions.
- [Deferred scope](./docs/prd/06-deferred-scope.md): what is out of this release.
- [Gap analysis](./docs/GAP_ANALYSIS.md): what is built, what is verified, what is still open.
- [Design system](./docs/design/tracck-design-system.html): tokens, components and patterns.

## Local setup

Install each app on its own:

```bash
cd backend && pnpm install
```

```bash
cd frontend && pnpm install
```

Copy each app's `.env.example` to `.env` (backend) or `.env.local` (frontend) and fill it in. The variables are listed in the example files, each with a comment.

- **Frontend:** the two `NEXT_PUBLIC_SUPABASE_*` values let people sign in. Without them, sign-in explains what is missing. `NEXT_PUBLIC_API_URL` points at the backend.
- **Backend:** `DATABASE_URL`, `REDIS_URL` and `SUPABASE_URL` are required. The others enable integrations; a feature whose settings are missing answers `503 NOT_CONFIGURED` and the rest of the API keeps working.

Run each app in its own terminal:

```bash
cd backend && pnpm dev
```

```bash
cd frontend && pnpm dev
```

## Database

The schema is `backend/src/db/schema.ts`. Migrations are generated from it into `backend/drizzle/`:

- `pnpm db:generate` writes a new migration file from schema changes. It does not apply it.
- `pnpm db:migrate` applies pending migrations to `DATABASE_URL`. Run it only when you intend to change the database.

Do not edit an existing migration file.

## Checks

Run inside each app folder:

```bash
pnpm typecheck
```

```bash
pnpm lint          # frontend
pnpm test          # backend
```

The backend tests need no database or Redis: they run the real migrations against an in-process PostgreSQL (PGlite) and fake the outside services.

## License

MIT License.
