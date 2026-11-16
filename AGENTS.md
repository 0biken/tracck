1. Never guess object shapes/properties (e.g. defaulting with `??`/`||` to paper over uncertainty). Verify against the source of truth first: the backend/data layer or schema where the object is defined.

2. I use pnpm, don't modify migration files directly, always use the script/helper the orm supports for running migration, don't run these migrations unless i said so explicitely

2. I love reusable and modular code, strive to always make utilities reusable and avoid duplication 

3. Produce clean code, that is easy to maintain, high cohesion and low coupling between modules 
4. When generating prompts for AI models, ensure it's concise & specific not verbose, even while intracting with me and making changes i like concise responses, except when i implcitely want to go indept. 
5. You don't have to run tests for every code change, only when a major feature is implemented, fixes aren't major features and you can selectively run tests that applies.
6. Use [tracck-language](.agents/skills/tracck-language/SKILL.md) when writing or editing user-facing copy, including frontend and emails, never use em dashes.
7. Use the `verify-app` skill when choosing, generating, or running tests.
8. Prefer integration tests; avoid testing every function. Add unit tests only for complex isolated logic or specific regressions.
9. When verification needs login, reuse a valid session first; otherwise read the required `admin` or `user` credentials from `playwrite/auth.json`. Never commit or print credentials. This file contains login credentials, not Playwright storage state.
10. Use `debug-app` for debugging: read relevant code and available backend development terminal output or logs, fix the root cause, then verify. Fix only clearly related incidental issues.

11. Never push or switch to master unless i explicitely say so.

12. Do not compare conditions against literal strings. Reuse an existing shared constant or enum; if none exists, declare the value once in an appropriate shared module and import it wherever needed. For example, compare `BASIC.ENVIRONMENT` with `ENVIRONMENTS.local` instead of `"local"`.

13. Scope & current focus: The main feature being worked on is the resume generation and job-tailoring engine (tailored one-page ATS resumes from verified proof of work). Organisation and API integration features are deferred and not supported right now; do not link organisation or API waitlist pages or display API integration claims in the UI.
