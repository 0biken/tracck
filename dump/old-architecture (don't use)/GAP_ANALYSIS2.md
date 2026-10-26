# Gap analysis

What is built, what has been checked, and what is still open. Last updated 2026-10-26.

## Built

| Area | Backend | Frontend |
|---|---|---|
| Sign-in, signup, Google, password reset | Supabase Auth, token check | Login, signup, reset, return to requested page after sign-in |
| Onboarding | Roles, policy agreement, onboarding completion | Role, details, sources, status |
| Sources | GitHub OAuth, CV and LinkedIn upload, portfolio links, pasted text, refresh, retry, removal | Sources screen with live progress |
| Evidence | Library with pin, exclude, edit (version-checked), duplicate detection and resolution, manual entries | Evidence library, add entry |
| Career Graph | Aggregated by month, project and skill | Graph with project explorer |
| CV feedback | Review job, latest review | Feedback screen, start review |
| Resumes | Job reading, generation job, versions, bullet edit, move, remove, restore, regenerate, PDF and Word export, delete one or all | List, new resume, generating screen, editor with match report |
| Settings and plan | Profile, preferences, roles, plan usage | Settings, plan cards, notification and retention settings, data export, account deletion |
| Billing | Paystack checkout, verify, webhook (signed, idempotent), cancel, lapse to free. Payment records are kept after account deletion | Plan purchase, return from checkout |
| Email | Resend sender, templates, respects notification settings | Preferences only |
| Scheduled work | Daily source refresh, weekly digest, cleanup (CV retention, lapsed plans, old exports) | — |
| Privacy | Data export as a zip, account deletion with billing stop | Settings actions |
| Waitlist | Public entry with per-IP rate limit | Waitlist form |

## Checked

- Backend: typecheck and 193 tests pass. The tests run the real migrations against an in-process PostgreSQL and fake GitHub, Paystack, Resend and storage.
- Frontend: typecheck, lint and production build pass.

## Not checked

- No real Supabase, Postgres, Redis, GitHub, Paystack, Resend or Storage account has been used.
- No screen has been walked through in a browser.
- Migrations have not been applied to a real database.

## Open

- **AI engine.** The placeholder engine writes resumes from the person's own wording, with no real drafting or checking. Real quality depends on the Gemini engine.
- **Package manager.** Both apps have pnpm and npm lockfiles. Keep one.
- **Migration `0004` (payments).** Generated, not applied. It keeps payment rows when an account is deleted. Apply with `pnpm db:migrate` when ready.
- **Shared job type.** `webhook_delivery` is still in the shared job list, but its handler was removed.
- **Deferred.** The organisation API, staff console, consent requests and partner webhooks are out of this release. See [06-deferred-scope.md](./prd/06-deferred-scope.md).
