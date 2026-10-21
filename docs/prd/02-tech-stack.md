# Tech Stack and Tools

Approved by user: yes, 2026-10-19 (as written). Pro plan gets a fair-use monthly generation cap (user decision, 2026-10-19); the cap number is set after cost per resume is measured.

Constraints used for every choice: one developer builds and runs this, so fewer moving parts beat flexibility. The developer works in NestJS, PostgreSQL, Redis, BullMQ and Docker and is learning Go. This document gives no timeline and no budget. Prices are vendor prices checked on 2026-10-19, listed so the technical team can see what each choice costs to run.

## Core stack

| Layer | Choice | Why | Alternatives considered |
|---|---|---|---|
| Web app | Next.js 16 (React), Tailwind CSS, shadcn/ui | Server rendering for the public pages, a large component ecosystem, one language across web and API. Package is actively maintained ([A-37](05-assumptions-risks-questions.md#a-37)) | Plain React with Vite (no server rendering, fine for the app but weaker for public pages and the later public profile link) |
| API | NestJS 12 (TypeScript) | The developer's existing skill. Modules map to the domains here (sources, graph, generation, billing, API clients) | Fastify with plain modules (less structure for a solo codebase that will grow). Go (still being learned, so slower to ship) |
| Background jobs | BullMQ through `@nestjs/bullmq`, run as a separate worker process from the same codebase | Source collection, document parsing and generation are slow and must survive restarts. The developer already knows BullMQ | Postgres-based queue such as pg-boss (one fewer service, but less familiar). Hosted queue services (more cost, new concepts) |
| Queue store | Redis, run as a container with append-only-file persistence and `maxmemory-policy noeviction` | BullMQ requires the no-eviction setting and recommends persistence ([A-20](05-assumptions-risks-questions.md#a-20)) | Upstash Redis fixed plan (no per-command billing, but persistence for BullMQ is unconfirmed, [A-21](05-assumptions-risks-questions.md#a-21)) |
| Database | PostgreSQL with pgvector, managed by Supabase Pro | Relational data fits the Career Graph (nodes and edges as tables). pgvector handles semantic matching without a second database | Neon (also has pgvector on every plan, [A-18](05-assumptions-risks-questions.md#a-18)). A graph database (extra service, no need at this size) |
| ORM and migrations | Drizzle ORM | Stable release line, SQL-like, light. Prisma's current release tag is a release candidate ([A-37](05-assumptions-risks-questions.md#a-37)) | Prisma (good tooling, but pin to the last stable release if chosen) |
| Authentication | Supabase Auth (email and Google sign-in) plus GitHub OAuth as a source connection | Included in the database plan, 100,000 monthly users on Pro ([A-16](05-assumptions-risks-questions.md#a-16)) | Better Auth (self-hosted, more control, more to run) |
| File storage | Supabase Storage for CV uploads and PDF exports | Same account and access rules as the database. 100 GB on Pro | Cloudflare R2 (cheaper at scale, no egress fees, [A-26](05-assumptions-risks-questions.md#a-26)) |
| AI access | A thin in-house gateway module with schema-validated output (zod), used by OpenAI and Google clients | Lets the team swap models without touching feature code. Both providers support JSON-schema output ([A-31](05-assumptions-risks-questions.md#a-31), [A-32](05-assumptions-risks-questions.md#a-32)) | A third-party router (another vendor between Tracck and user data) |
| Models | Writer, bulk extraction and independent checker as three separate roles, each from a configurable list (see [DR-6](#dr-6-ai-models-and-routing)) | The checker must come from a different model family than the writer | A single model for everything (cheaper to build, weaker checking) |
| Evaluation | A test set of real and synthetic profiles, with a custom script or promptfoo | Needed to measure invented claims, cost and quality when a model changes | Manual review only (does not catch regressions) |
| Document parsing | pdfjs-dist (PDF text), mammoth (DOCX), yauzl (ZIP), csv-parse (CSV), tesseract.js (OCR fallback for scanned CVs) | All maintained ([A-37](05-assumptions-risks-questions.md#a-37)). Covers CVs and the LinkedIn, X export files | pdf-parse (last changed Oct 2025). A paid document-parsing API (new data processor) |
| PDF export | Puppeteer with Chromium in the worker, rendering an HTML template | Full control of layout and text selectable for ATS. Chromium is available in the dev environment | `@react-pdf/renderer` (no browser, but limited layout control) |
| DOCX export (Phase 2) | docx library | Maintained, builds Word files in code | Converting the PDF (poor quality) |
| GitHub access | Octokit (`@octokit/rest` and `@octokit/graphql`) | Official client. Public data needs no scope ([A-46](05-assumptions-risks-questions.md#a-46)) | Raw HTTP calls |
| Payments | Paystack | Naira cards, bank transfer, subscriptions and reusable card authorisations ([A-28](05-assumptions-risks-questions.md#a-28)) | Flutterwave (2% local fee, subscription support unconfirmed, [A-30](05-assumptions-risks-questions.md#a-30)) |
| Email | Resend | Simple API, sender-domain authentication. The free plan is capped at 100 emails per day ([A-27](05-assumptions-risks-questions.md#a-27)) | Amazon SES or Postmark (more setup) |
| API keys for organisations | In-house module in the NestJS API | Per-client keys with scopes, quotas, rotation and audit need to sit next to the tenant data model ([DR-10](#dr-10-per-client-api-keys)) | Unkey (prices known, scopes and self-hosting unconfirmed, [A-41](05-assumptions-risks-questions.md#a-41)) |
| Hosting | Railway for API, worker and Redis. Vercel Pro for the web app | One place for the long-running worker. See [DR-5](#dr-5-hosting-and-region) | One Hetzner server running Docker (cheapest, most to operate, prices not retrievable, [A-25](05-assumptions-risks-questions.md#a-25)) |
| Errors and analytics | Sentry (errors), PostHog (product events), pino (structured logs) | Free tiers cover the private beta ([A-40](05-assumptions-risks-questions.md#a-40)) | Self-hosted logging (more to run) |
| Local development and CI | Docker Compose, GitHub Actions | Matches the developer's current workflow | None considered |

## External services and integrations

| Service | Purpose | Pricing (checked 2026-10-19) | Region/availability | Limits/quotas | Caveats | Source |
|---|---|---|---|---|---|---|
| Supabase | Postgres, auth, storage | Free: 500 MB database, 50,000 monthly users, 1 GB storage. Pro: $25 per month, 8 GB database, 100,000 monthly users, 100 GB storage | Europe only for this audience (Frankfurt, Ireland, London, Paris, Zurich, Stockholm). No Africa | Free projects pause after one week of inactivity | Latency from Nigeria not measured. Use Pro for anything real | [Pricing](https://supabase.com/pricing), [regions](https://supabase.com/docs/guides/platform/regions) ([A-16](05-assumptions-risks-questions.md#a-16), [A-17](05-assumptions-risks-questions.md#a-17)) |
| Railway | Run API, worker and Redis | Hobby $5 and Pro $20 minimum, then per-second usage: $0.00000772 per vCPU-second, $0.00000386 per GB-second, $0.05 per GB egress | Regions not on the pricing page | Usage-based, no fixed instance | Whether a region near Nigeria exists is unverified ([A-23](05-assumptions-risks-questions.md#a-23)) | [Pricing](https://railway.com/pricing) ([A-22](05-assumptions-risks-questions.md#a-22)) |
| Vercel | Host the Next.js app | Hobby is non-commercial only. Pro $20 per month with $20 usage credit | Global edge network | Not checked beyond plan | Hobby cannot be used for a paid product | [Pricing](https://vercel.com/pricing) ([A-24](05-assumptions-risks-questions.md#a-24)) |
| Upstash Redis (option) | Hosted Redis | Pay-as-you-go $0.20 per 100,000 commands, 500,000 free per month. Fixed plans $10 (250 MB) and $20 (1 GB) | Not checked | BullMQ polls often, so command-based billing can climb | Persistence and eviction settings for BullMQ unconfirmed | [Pricing](https://upstash.com/pricing/redis) ([A-19](05-assumptions-risks-questions.md#a-19), [A-21](05-assumptions-risks-questions.md#a-21)) |
| Neon (option) | Postgres | Free plan. Pay-as-you-go $0.106 per compute-hour and $0.35 per GB-month | Frankfurt, London, US, Singapore, Sydney, São Paulo. No Africa | Free: 1 GB per project | Compute can scale to zero, so first request after idle may be slow (not measured) | [Pricing](https://neon.com/pricing), [regions](https://neon.com/docs/introduction/regions) ([A-18](05-assumptions-risks-questions.md#a-18)) |
| Hetzner Cloud (option) | Single server | Prices did not load | Germany, Finland, Singapore, USA. No Africa | n/a | Prices unverified | [Hetzner](https://www.hetzner.com/cloud/) ([A-25](05-assumptions-risks-questions.md#a-25)) |
| Cloudflare R2 (option) | Object storage | $0.015 per GB-month, no egress fees, 10 GB free | Global | n/a | Adds a vendor | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) ([A-26](05-assumptions-risks-questions.md#a-26)) |
| OpenAI API | Writer and bulk models | Per million tokens (input / output): GPT-6.1 Sol $2 / $10, GPT-6 Luna $0.10 / $0.50, GPT-6 Astra $10 / $50 | Data residency in ten regions on Enterprise only, none in Africa | Account rate limits not checked | Prices come from a third-party page, not OpenAI's own | [Morph](https://morphllm.com/openai-api-pricing), [OpenAI](https://openai.com/api/pricing/) ([A-34](05-assumptions-risks-questions.md#a-34), [A-35](05-assumptions-risks-questions.md#a-35)) |
| Google Gemini API | Writer, bulk and checker | Per million tokens (input / output): 4 Argon $2 / $10 until 30 Nov 2026, then $4 / $20. 3.8 Flash $0.75 / $3.75 until 31 Dec 2026, then $1.50 / $7.50. 3.5 Flash-Lite $0.30 / $2.50 | Global API | Rate limits not checked | Paid-tier data is not used to improve products. Introductory prices end soon | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) ([A-33](05-assumptions-risks-questions.md#a-33)) |
| Open-weight models (option) | Bulk extraction or checker, self-hosted or through a host | Licences: Qwen3.8-27B Apache 2.0, DeepSeek V4 MIT, MiMo-V2.6-Pro MIT. Kimi K3 has licence conditions | Where hosted decides data location | Needs GPU hosting or a provider | Hosting cost and quality on resumes not measured | Earlier research in this project |
| Paystack | Subscriptions and one-off payments | Local cards 1.5% + ₦100 (₦100 waived under ₦2,500), capped at ₦2,000. International 3.9% + ₦100 | Nigeria | Plans from hourly to annual | Retry behaviour for failed renewals is documented inconsistently. Business registration requirement not confirmed | [Docs](https://paystack.com/docs/payments/recurring-charges/) ([A-28](05-assumptions-risks-questions.md#a-28), [A-29](05-assumptions-risks-questions.md#a-29), [A-10](05-assumptions-risks-questions.md#a-10)) |
| Resend | Transactional email | Free: 3,000 per month, 100 per day. Pro: $20 for 50,000 per month. Scale: $90 | Global | 100 per day on free | A launch-day wave of verification emails exceeds the free daily cap | [Pricing](https://resend.com/pricing) ([A-27](05-assumptions-risks-questions.md#a-27)) |
| GitHub API | Collect public work | Free. 5,000 requests per hour per signed-in user, 60 unauthenticated | Global | Events API returns 30 days and 300 events at most. GraphQL contribution window defaults to one year | API terms bar selling personal information to recruiters or job boards | [Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) ([A-43](05-assumptions-risks-questions.md#a-43) to [A-48](05-assumptions-risks-questions.md#a-48)) |
| LinkedIn | Profile data | Not an API source. Export file, PDF or pasted text | n/a | Sign-in returns name, photo, email and locale only | Export contents are unconfirmed first-hand | [Docs](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) ([A-49](05-assumptions-risks-questions.md#a-49) to [A-51](05-assumptions-risks-questions.md#a-51)) |
| X (Phase 2) | Posts | API: $0.005 per post read. Archive file is free | Global | 3 million posts per month cap | Developer policy limits storage and redistribution. Archive file used instead | [X pricing](https://docs.x.com/x-api/getting-started/pricing) ([A-52](05-assumptions-risks-questions.md#a-52), [A-53](05-assumptions-risks-questions.md#a-53)) |
| Figma (Phase 2) | Design links | Free API access. OAuth | Global | Token reaches only files the user can open | Public-file access without the owner unconfirmed | [Scopes](https://developers.figma.com/docs/rest-api/scopes) ([A-54](05-assumptions-risks-questions.md#a-54), [A-55](05-assumptions-risks-questions.md#a-55)) |
| Behance (Phase 2) | Portfolio | No dependable API. Pasted links, PDFs and manual entry | n/a | n/a | New developer access unclear | [Adobe community](https://experienceleaguecommunities.adobe.com/t5/adobe-developer-questions/how-can-i-obtain-an-api-key-or-access-to-behance-s-api-for/m-p/622761) ([A-56](05-assumptions-risks-questions.md#a-56)) |
| Sentry and PostHog | Errors and product events | Sentry free 5,000 errors, Team $29. PostHog free 1M events | Global | Free limits | Check data location for personal data | [Sentry](https://sentry.io/pricing/), [PostHog](https://posthog.com/pricing) ([A-40](05-assumptions-risks-questions.md#a-40)) |

## Decision records

### DR-1: One codebase, two processes
Context. The product has request-time work (sign-in, editing, reading) and slow background work (collecting sources, parsing files, generating drafts, rendering PDFs). One developer cannot run many services.
Options. (a) Microservices. (b) One NestJS codebase with an API process and a worker process. (c) Serverless functions for everything.
Decision. (b). The API and the worker share modules and the database and run as two processes started from the same image.
Consequences. Simple to deploy and test. A heavy job can starve others unless the worker has its own concurrency limits ([NFR](03-architecture.md#non-functional-requirements) to follow). If the product grows, the worker can be split out without rewriting.

### DR-2: PostgreSQL stores the Career Graph
Context. The Career Graph links people, evidence items, skills, roles and claims, and every bullet must trace back to evidence.
Options. (a) PostgreSQL with relational tables for nodes and edges, and pgvector for similarity. (b) A dedicated graph database.
Decision. (a). Traversals here are shallow (evidence to claim to bullet), so joins are enough.
Consequences. One database to back up. If queries become deep, revisit. Embedding model and its price are unverified ([A-36](05-assumptions-risks-questions.md#a-36)), so semantic search starts as an optional step, not a dependency of the first slice.

### DR-3: Supabase for database, auth and storage
Context. The developer needs managed Postgres, sign-in and file storage without running them.
Options. Supabase Pro, Neon plus a separate auth and storage service, or self-managed Postgres in Docker.
Decision. Supabase Pro in a European region. Free tier pauses after a week of inactivity, so it is for local experiments only ([A-16](05-assumptions-risks-questions.md#a-16)).
Consequences. No African region exists ([A-17](05-assumptions-risks-questions.md#a-17)), so every request from Nigeria crosses a continent. Latency is unmeasured. Personal data leaves Nigeria, which is a cross-border transfer under the data protection law ([A-14](05-assumptions-risks-questions.md#a-14), [A-38](05-assumptions-risks-questions.md#a-38)). Exit path: standard Postgres dump to any other host. Supabase Auth users can be exported, but password hashes need checking before relying on that.

### DR-4: Redis run by the team, not a hosted queue service
Context. BullMQ loses jobs if Redis evicts keys or restarts without persistence ([A-20](05-assumptions-risks-questions.md#a-20)).
Options. Self-run Redis container with persistence, Upstash fixed plan, Upstash pay-as-you-go.
Decision. Self-run Redis on the same platform as the worker, append-only file on, `noeviction` set. Upstash pay-as-you-go is rejected because BullMQ's constant polling is billed per command ([A-19](05-assumptions-risks-questions.md#a-19)).
Consequences. One more container to watch and a volume to back up. Reconsider Upstash's fixed plan only after a test confirms persistence ([A-21](05-assumptions-risks-questions.md#a-21)).

### DR-5: Hosting and region
Context. Users are in Nigeria. Supabase, Neon and Hetzner have no African region, and Railway's regions are unverified.
Options. (a) Railway for API and worker plus Vercel for web. (b) One Hetzner server with Docker. (c) Everything on Vercel and serverless.
Decision. (a). The worker needs long-running processes, which suits Railway and not serverless functions. Put the API and worker in the same region as the database, in Europe.
Consequences. Keeping API, worker and database together makes server-side work fast, while browser requests from Nigeria still cross to Europe. Test round-trip time from Lagos before launch ([A-23](05-assumptions-risks-questions.md#a-23)). Hetzner stays the fallback if usage-based billing grows faster than expected, and its prices still need checking ([A-25](05-assumptions-risks-questions.md#a-25)).

### DR-6: AI models and routing
Context. Resume quality is the product. Claims must trace to evidence, and a checker that shares the writer's blind spots will miss the same mistakes.
Options. Writer: GPT-6.1 Sol, Gemini 4 Argon, Kimi K3. Bulk extraction: Gemini 3.8 Flash, GPT-6 Luna, open-weight models. Checker: a model from a different family than the writer.
Decision. Build the gateway so each role reads its model from configuration, and start with GPT-6.1 Sol as writer and Gemini 3.8 Flash as checker, pending the evaluation set. Pick the bulk model by measuring on the test set, not by price alone. Kimi K3 is not chosen because of licence conditions.
Consequences. Prices change on known dates: Argon doubles on 1 December 2026 and Flash doubles on 1 January 2027 ([A-33](05-assumptions-risks-questions.md#a-33)). Sol, Luna and Astra prices come from a third-party page ([A-34](05-assumptions-risks-questions.md#a-34)). Sending user data to foreign providers needs consent text, data processing terms and a transfer assessment ([A-14](05-assumptions-risks-questions.md#a-14)). Model choice moves cost per resume by about twenty times, so it needs a decision once measured ([Q-5](05-assumptions-risks-questions.md#q-5)).

### DR-7: Structured output and validation
Context. The write, check and improve loop passes structured data between steps.
Options. Free text with parsing, or JSON-schema output from the provider checked again in code.
Decision. Use provider schema output ([A-31](05-assumptions-risks-questions.md#a-31), [A-32](05-assumptions-risks-questions.md#a-32)) and validate every response with zod. Schema conformance does not guarantee correct content, so a separate check compares every number and named entity in a bullet against its evidence.
Consequences. Refusals and truncation are handled in code and retried or surfaced to the user.

### DR-8: Document parsing and PDF export
Context. Users upload CVs in PDF or DOCX and export a one-page PDF that applicant tracking systems can read.
Options. Library parsing and browser rendering, or paid third-party services.
Decision. Libraries listed in the core stack. Puppeteer renders HTML to PDF inside the worker, with real text and no images of text.
Consequences. Chromium raises worker memory use and image size. Scanned CVs need OCR, which is slower and less accurate, and tesseract.js's behaviour on Nigerian-style CVs is unmeasured.

### DR-9: Payments
Context. Pro is ₦2,500 per month, and users are mostly in Nigeria.
Options. Paystack or Flutterwave.
Decision. Paystack for plans and subscriptions, with webhooks verified by signature and processed idempotently.
Consequences. Failed-renewal retry behaviour is inconsistent in the docs ([A-28](05-assumptions-risks-questions.md#a-28)), so the app tracks subscription state itself and handles expiring cards. Whether a company registration is needed to go live is unconfirmed ([A-29](05-assumptions-risks-questions.md#a-29)). Flutterwave is the exit path.

### DR-10: Per-client API keys
Context. Organisations such as ITConnect need keys with limits and an audit trail, tied to user consent.
Options. Build in the API, or use Unkey.
Decision. Build in the API. Keys have a visible prefix and a hashed secret shown once, labels, live and sandbox modes, scopes, expiry, rotation, per-key rate limits and quotas, and usage events. Tables: `api_clients`, `api_keys`, `api_usage_events`. Every data table carries a tenant or owner identifier from the first migration.
Consequences. More code for the developer, no extra vendor holding keys. Unkey's free tier covers 1,000 keys and 150,000 requests per month, but scopes and self-hosting are unconfirmed ([A-41](05-assumptions-risks-questions.md#a-41)).

## Estimated running cost

This is vendor price information for the technical team, not a budget. Dollar figures convert at the official rate of about ₦1,331.77 per dollar on 8 October 2026 ([A-39](05-assumptions-risks-questions.md#a-39)). The parallel market was a little higher. Token counts per task are my assumptions ([A-42](05-assumptions-risks-questions.md#a-42)) and must be measured on the test set.

### Fixed monthly services

| Item | Private beta (about 50 users) | Launch scale (2,000 users) | 10x (20,000 users) |
|---|---|---|---|
| Supabase | Pro $25 | Pro $25 (database may pass 8 GB at 10x, which adds usage charges) | Pro $25 plus usage |
| Railway | $5 to $20 plus usage | $20 plus usage | $20 plus usage, with more worker CPU |
| Vercel | Pro $20 | Pro $20 | Pro $20 plus usage |
| Resend | Free | Pro $20 (free's 100 per day will be exceeded) | Pro $20 or Scale $90 |
| Sentry and PostHog | Free | Free to Team $29 | Team $29 or more |

Usage-based Railway cost cannot be given as one number. One vCPU running all month costs about $20 at the listed rate ([A-22](05-assumptions-risks-questions.md#a-22)), and a worker running Chromium will use more than one.

### AI cost per task (vendor prices, today)

| Task | Model | Cost now | Cost after introductory prices end |
|---|---|---|---|
| Writing pass (30,000 tokens in, 3,000 out) | GPT-6.1 Sol | $0.09 | $0.09 |
| Writing pass | Gemini 4 Argon | $0.09 | $0.18 from 1 Dec 2026 |
| Writing pass | Kimi K3 | $0.135 | $0.135 |
| Check pass (15,000 in, 2,000 out) | Gemini 3.8 Flash | about $0.019 | about $0.0375 from 1 Jan 2027 |
| One-time evidence extraction (200,000 in, 20,000 out) | Gemini 3.8 Flash | $0.225 | $0.45 from 1 Jan 2027 |
| One-time evidence extraction | GPT-6 Luna | $0.03 | $0.03 |

### What this means for the ₦2,500 Pro plan

₦2,500 is about $1.88. After Paystack's local fee (1.5% plus ₦100, so ₦137.50) about ₦2,362 is left, roughly $1.77. A write and check pass with Sol and Flash costs about $0.11 now and about $0.13 after 1 January 2027. At that rate, a Pro user who runs more than about 16 full passes in a month costs more in AI alone than they pay, falling to about 13 passes after the introductory price ends, before counting one-time extraction, hosting or email. A single resume usually takes more than one write and improve cycle, so the real number of resumes at break-even is lower still. Pro was described as unlimited in v2.0. On 2026-10-19 the decision was to give Pro a fair-use monthly cap, with the number set after cost per resume is measured ([Q-10](05-assumptions-risks-questions.md#q-10)). A cheaper model for the improve step is another lever. Pricing itself is the founding team's choice.

Not estimated: embeddings (no price found, [A-36](05-assumptions-risks-questions.md#a-36)), Hetzner, X API reads, OCR compute, and Redis hosting on Railway.

Next: [Architecture](03-architecture.md)
