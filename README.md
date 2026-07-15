# Tracck

**Turn your public record into a resume — automatically.**

Tracck is an automated professional accomplishment tracker and ATS-optimized resume generator. It ingests your activity from platforms like GitHub, X (Twitter), LinkedIn, Instagram, Figma, and Behance, runs it through a multi-stage AI pipeline to extract and verify genuine achievements, and builds beautiful, ready-to-download PDF and DOCX resumes — tailored to specific job descriptions.

> Built for developers, designers, and professionals who ship constantly but never update their resume.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Data Flow](#data-flow)
- [Platform Support & Ingestion Methods](#platform-support--ingestion-methods)
- [Database Schema](#database-schema)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Security](#security)
- [Documentation](#documentation)
- [License](#license)

---

## Overview

Most professionals build impressive track records across GitHub repos, LinkedIn posts, X threads, and design portfolios — but lose those wins to time because keeping a resume up to date is a chore.

Tracck solves this by acting as a continuous, automated professional ledger:

1. **Ingest** raw content from connected platforms (OAuth) or via manual paste/file upload for platforms without viable APIs.
2. **Classify** each piece of content with a multi-stage AI pipeline — filtering out future plans, other people''s posts, and vague sentiment to surface only real, first-person, past-tense accomplishments.
3. **Generate** ATS-optimized resume bullets with confidence scores, surfaced for user confirmation.
4. **Build** a complete, versioned resume (PDF + DOCX) — with optional role-tailoring that scores and reorders bullets to match a specific job description.

---

## Features

| Feature | Description |
|---|---|
| **Multi-platform Ingestion** | Pulls from GitHub, Figma via OAuth; LinkedIn, X, Instagram, Behance via manual paste or file upload |
| **AI Claim Extraction** | Two-stage Gemini pipeline: signal detection (is this a real achievement?) then bullet generation |
| **Claim Classification** | Distinguishes `direct_achievement`, `participation_claim`, `future_plan`, `third_party_share`, and `vague_sentiment` before generating any bullets |
| **Confidence Scoring** | `model_confidence x source_trust_multiplier` — OAuth-sourced content scores higher than paste by design |
| **Review Queue** | Every AI-generated bullet requires user confirmation before entering the resume ledger |
| **Role Tailoring** | Parse a job description, score your confirmed accomplishments by relevance, and produce a tailored resume without inventing new content |
| **ATS-Optimized Output** | PDF (Puppeteer) and DOCX (docx-js) with no tables, images, or special characters that break ATS parsers |
| **Resume Versioning** | Every resume build is stored as a new version; downloadable via signed URLs |
| **Email Notifications** | Resend-powered emails alert users when new wins are detected and ready for review |
| **Decoupled Workers** | Heavy processing (scraping, AI, PDF generation) runs in isolated BullMQ workers, completely off the UI request path |

---

## Architecture

Tracck is split across three deployment targets:

```
+---------------------------------------------------------------+
|  DNS: tracck.io -> Vercel Edge Network                        |
|                                                               |
|  +----------------------------------------------------------+  |
|  |  Vercel (Frontend + API)                                 |  |
|  |  - Next.js App Router (SSR + RSC)                        |  |
|  |  - API Routes — serverless functions                     |  |
|  |  - OAuth callbacks, session management                   |  |
|  +-------------------------+--------------------------------+  |
|                            |                                   |
|  +-------------------------v------------------------------+    |
|  |  Supabase (PostgreSQL 15 + Auth + Storage)            |    |
|  |  Region: africa-south1                                 |    |
|  |  - Row-Level Security on every table                   |    |
|  |  - Realtime webhooks -> enqueue BullMQ jobs            |    |
|  |  - Storage: resumes/ and exports/ buckets              |    |
|  +--------------------------------------------------------+    |
|                                                               |
|  +----------------------------------------------------------+  |
|  |  Railway (Workers — always-on Node.js processes)        |  |
|  |  - social-fetch   - ai-extraction   - resume-build      |  |
|  |  - notification   - ats-score                           |  |
|  +----------------------------------------------------------+  |
|                                                               |
|  +----------------------------------------------------------+  |
|  |  Upstash Redis (Serverless)                             |  |
|  |  - BullMQ queue persistence                             |  |
|  |  - OAuth state tokens (TTL 10min)                       |  |
|  |  - Rate limit counters per platform                     |  |
|  +----------------------------------------------------------+  |
+---------------------------------------------------------------+
```

### Worker Queue Configuration

| Queue | Concurrency | Max Retries | Backoff |
|---|---|---|---|
| `social-fetch` | 5 | 3 | Exponential 30s |
| `ai-extraction` | 10 | 5 | Exponential 10s |
| `resume-build` | 3 | 3 | Fixed 15s |
| `notification` | 20 | 2 | Fixed 5s |
| `ats-score` | 5 | 3 | Exponential 10s |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js](https://nextjs.org/) (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL 15 + Auth + Storage) |
| **Job Queues** | [BullMQ](https://docs.bullmq.io/) + [Upstash Redis](https://upstash.com/) |
| **AI Provider** | [Google Gemini API](https://aistudio.google.com/) (`gemini-flash-latest`) |
| **Web Scraping** | [Firecrawl](https://firecrawl.dev/) |
| **Email** | [Resend](https://resend.com/) |
| **PDF Generation** | [Puppeteer](https://pptr.dev/) (runs on Railway — cannot run on Vercel serverless) |
| **DOCX Generation** | [docx-js](https://docx.js.org/) |
| **Deployment** | Vercel (frontend), Railway (workers) |

---

## Data Flow

### Full Ingestion to Resume Pipeline

```
User connects GitHub
       |
       v
POST /api/accounts/connect
  -> Supabase: INSERT connected_accounts
  -> BullMQ: Enqueue social-fetch
       |
       v
Worker: social-fetch
  -> GitHub Events API (last 90 days)
  -> Dedup against existing raw_posts
  -> Supabase: Bulk INSERT raw_posts
       |
       v
Supabase DB Webhook (on INSERT to raw_posts)
  -> BullMQ: Enqueue ai-extraction (batches of 50)
       |
       v
Worker: ai-extraction — Gemini Stage 1 (Claim Classification)
  -> Classify each post:
      direct_achievement    -> proceed to Stage 2
      participation_claim   -> proceed to Stage 2
      future_plan           -> discard
      third_party_share     -> discard
      vague_sentiment       -> discard
       |
       v
Worker: ai-extraction — Gemini Stage 2 (Bullet Generation)
  -> Generate ATS-optimized resume bullet
  -> Compute confidence_score = model_confidence x source_trust_multiplier
  -> confidence >= 0.7 -> INSERT accomplishments (status: pending)
  -> confidence <  0.7 -> INSERT accomplishments (status: low_confidence)
  -> Enqueue notification
       |
       v
User reviews confirmation queue
  -> Confirm -> INSERT resume_bullets + PATCH accomplishments status=confirmed
  -> Enqueue resume-build (triggers at 3+ confirmed bullets)
       |
       v
Worker: resume-build
  -> Fetch confirmed bullets, skills, profile, experience
  -> Gemini Stage 3: Generate 2-sentence professional summary
  -> Assemble resume object in memory
  -> ATS compliance check (no tables / images / special chars)
  -> Puppeteer -> PDF  |  docx-js -> DOCX
  -> Upload to Supabase Storage (resumes/{user_id}/{version}/)
  -> INSERT resumes row (version++, pdf_url, docx_url)
  -> Enqueue ats-score
       |
       v
Worker: ats-score
  -> Score resume across 5 dimensions (weighted average)
  -> UPDATE resumes.ats_score
  -> Notify user: resume ready
```

---

## Platform Support & Ingestion Methods

| Platform | OAuth? | Primary Ingestion | Notes |
|---|---|---|---|
| **GitHub** | Full | OAuth | Events API + Repos API; last 90 days |
| **Figma** | Full | OAuth | Files API; public files only |
| **X (Twitter)** | Limited | Manual paste | Meaningful read access requires paid API tier; paste is primary for free users |
| **LinkedIn** | Restricted | Manual paste + CSV export | LinkedIn data export ZIP/CSV gives higher volume than copy-paste |
| **Instagram** | Business accounts only | Manual paste | Graph API requires Business/Creator account; personal accounts use paste |
| **Facebook** | Not built | Manual paste | Graph API not viable for personal post data; paste only |
| **Behance** | No API | Manual paste | Adobe deprecated Behance API (~2021); paste only, permanently |

### Manual Paste Flow

For platforms without viable OAuth, Tracck provides a first-class paste ingestion path:

1. **Plain text paste** — textarea; one or more posts'' text
2. **Bulk paste with delimiter** — multiple posts separated by `---`; each becomes its own `raw_posts` row
3. **File upload** — LinkedIn data export (CSV/ZIP); parsed server-side
4. **Source attestation** — ownership confirmation checkbox (replaces OAuth''s implicit guarantee)
5. **Approximate date capture** — month/year prompt when no API-supplied timestamp exists

> Screenshot/OCR ingestion (for Instagram, Behance) is scoped as a post-MVP feature.

---

## Database Schema

Nine core migrations set up the production schema. Run via Supabase CLI or SQL Editor.

| Migration | Table | Purpose |
|---|---|---|
| `001_users.sql` | `users` | Profile: name, email, location, role tags, onboarding state |
| `002_connected_accounts.sql` | `connected_accounts` | OAuth tokens (AES-256-GCM encrypted), platform, token expiry |
| `003_raw_posts.sql` | `raw_posts` | Raw ingested content; `source_method` tracks OAuth vs. paste |
| `004_accomplishments.sql` | `accomplishments` | AI-generated bullets with confidence score and status |
| `005_resume_bullets.sql` | `resume_bullets` | Confirmed bullets ordered for resume build |
| `006_resumes.sql` | `resumes` | Versioned resume records with PDF/DOCX URLs and ATS score |
| `007_skills.sql` | `skills` | Extracted and manually added skills per user |
| `008_functions_and_triggers.sql` | Functions + Triggers | DB webhook trigger on `raw_posts` INSERT -> job queue |
| `009_rls_policies.sql` | RLS Policies | Row-Level Security — users can only access their own rows |

All migration files are in [`docs/`](./docs/).

### Key Schema Notes

- `raw_posts.source_method` — `CHECK (source_method IN (''oauth'', ''manual_paste'', ''file_upload''))` — used downstream to compute `source_trust_multiplier` in confidence scoring.
- `accomplishments.status` — `pending` | `confirmed` | `rejected` | `low_confidence`
- `connected_accounts.access_token` — AES-256-GCM encrypted at the application layer. Decryption key lives in Railway env only, never Supabase.

---

## Local Setup

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- An [Upstash Redis](https://upstash.com) database
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- A [Resend](https://resend.com) account
- A [Firecrawl](https://firecrawl.dev) API key

### Steps

**1. Clone the repository**

```bash
git clone https://github.com/0biken/tracck.git
cd tracck
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

```bash
cp .env.example .env.local
```

Fill in all required keys. See [Environment Variables](#environment-variables) below and the full reference in [`docs/env-secrets.md`](./docs/env-secrets.md).

**4. Set up the database**

Run all 9 migration files against your Supabase project in order:

```bash
# Via Supabase CLI (recommended)
supabase db push

# Or run each file manually in Supabase SQL Editor
# docs/001_users.sql through docs/009_rls_policies.sql
```

**5. Start the development server**

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

**6. Start the background workers** *(separate terminal)*

```bash
node workers/index.ts
```

> Workers are always-on processes and must be deployed to Railway in production — they cannot run as serverless functions.

---

## Environment Variables

### Vercel (Frontend + API Routes)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Server-side only — bypasses RLS

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AX4x...

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000  # https://tracck.io in production
ADMIN_API_KEY=                             # openssl rand -hex 32
OAUTH_STATE_SECRET=                        # openssl rand -hex 32
ENCRYPTION_KEY=                            # openssl rand -hex 32 (64 hex chars = 32 bytes)

# Firecrawl
FIRECRAWL_API_KEY=fc-...
```

### Railway (Worker Processes)

```env
# Everything above, plus:

# Google Gemini
GEMINI_API_KEY=AIza...

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@tracck.io

# Platform OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
FIGMA_CLIENT_ID=
FIGMA_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
```

> **Never commit secret values.** Use `.env.example` with empty values. See [`docs/env-secrets.md`](./docs/env-secrets.md) for where to obtain each key and full rotation policies.

---

## API Reference

All routes require a Supabase JWT (`Authorization: Bearer <token>`). Full contracts, request/response schemas, error codes, and rate limits are in [`docs/api-design.md`](./docs/api-design.md).

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/accounts/connect` | Connect a platform via OAuth |
| `GET` | `/api/accounts` | List connected accounts |
| `POST` | `/api/posts/paste` | Submit manual-paste content |
| `POST` | `/api/posts/import-archive` | Upload LinkedIn CSV/ZIP export |
| `POST` | `/api/posts/fetch-url` | Fetch content from a portfolio URL |
| `POST` | `/api/posts/scrape-profile` | Scrape a public social profile |
| `GET` | `/api/accomplishments` | List accomplishments by status |
| `PATCH` | `/api/accomplishments/:id` | Confirm, reject, or edit a bullet |
| `GET` | `/api/resumes` | List all resume versions |
| `POST` | `/api/resumes/build` | Trigger a resume build |
| `POST` | `/api/roles` | Submit a job description for role-tailoring |
| `GET` | `/api/roles/:id/matches` | Get accomplishments ranked by relevance |

---

## Project Structure

```
tracck/
+-- src/
¦   +-- app/
¦   ¦   +-- api/
¦   ¦   ¦   +-- posts/
¦   ¦   ¦   ¦   +-- fetch-url/        # Firecrawl portfolio URL ingestion
¦   ¦   ¦   ¦   +-- import-archive/   # LinkedIn CSV/ZIP import
¦   ¦   ¦   ¦   +-- paste/            # Manual text paste ingestion
¦   ¦   ¦   ¦   +-- scrape-profile/   # Public profile scraping
¦   ¦   ¦   +-- roles/                # Role-tailoring endpoints
¦   ¦   +-- auth/                     # Supabase OAuth callbacks
¦   ¦   +-- components/
¦   ¦   ¦   +-- PasteModal.tsx        # Manual paste UI
¦   ¦   ¦   +-- PortfolioFetchModal.tsx
¦   ¦   ¦   +-- ProfileScrapeModal.tsx
¦   ¦   +-- dashboard/
¦   ¦   ¦   +-- page.tsx              # Overview: stats, pending bullets, sync logs
¦   ¦   ¦   +-- accounts/             # Connect / manage accounts
¦   ¦   ¦   +-- queue/                # Accomplishment confirmation queue
¦   ¦   ¦   +-- tailoring/            # Role-tailoring & JD upload
¦   ¦   +-- login/
¦   ¦   +-- signup/
¦   +-- lib/
¦   ¦   +-- scrapers/
¦   ¦       +-- platform.ts           # Platform router
¦   ¦       +-- firecrawl.ts          # Firecrawl integration
¦   ¦       +-- extractors/
¦   ¦           +-- linkedin.ts
¦   ¦           +-- instagram.ts
¦   ¦           +-- behance.ts
¦   ¦           +-- generic.ts
¦   +-- utils/
¦       +-- supabase/
¦           +-- server.ts             # Server-side Supabase client
+-- workers/
¦   +-- index.ts                      # BullMQ worker bootstrap
+-- docs/
¦   +-- system-design.md
¦   +-- api-design.md
¦   +-- database-migrations.md
¦   +-- env-secrets.md
¦   +-- 001_users.sql
¦   +-- ...
¦   +-- 009_rls_policies.sql
+-- middleware.ts                      # Auth guard: redirects /dashboard to /login
+-- next.config.ts
+-- package.json
```

---

## Security

- **OAuth tokens** encrypted at rest with AES-256-GCM. Decryption key is in Railway env only — never stored in Supabase.
- **Row-Level Security** on every table ensures users can only read and write their own data.
- **No private social data stored** — only public post content fetched via public-scoped APIs.
- **Signed URLs** for resume downloads (Supabase Storage, 1hr TTL).
- **CORS** restricted to `tracck.io` origin on all API routes.
- **Rate limiting** via Upstash Redis — 100 requests/min per user.
- **CSRF prevention** — OAuth state tokens stored in Redis with a 10-minute TTL.

---

## Documentation

| Document | Purpose |
|---|---|
| [`system-design.md`](./docs/system-design.md) | Full architecture, data flow diagrams, infrastructure topology, key design decisions |
| [`api-design.md`](./docs/api-design.md) | REST API contracts, request/response schemas, error codes, rate limits |
| [`database-migrations.md`](./docs/database-migrations.md) | Complete PostgreSQL schema, RLS policies, trigger definitions |
| [`env-secrets.md`](./docs/env-secrets.md) | Every environment variable, where to get it, and rotation policy |
| [`01_product_addendum.md`](./docs/01_product_addendum.md) | Why claim extraction and role-tailoring are separate pipeline stages |
| [`02_ingestion_method_matrix.md`](./docs/02_ingestion_method_matrix.md) | Per-platform OAuth vs. paste decision rationale |
| [`03_claim_extraction_spec.md`](./docs/03_claim_extraction_spec.md) | Gemini prompt architecture, claim taxonomy, confidence scoring |
| [`04_role_tailoring_spec.md`](./docs/04_role_tailoring_spec.md) | JD parsing, relevance scoring, bullet re-ranking |
| [`05_data_model_updates.md`](./docs/05_data_model_updates.md) | Schema migrations extending `raw_posts` and `accomplishments` |
| [`06_master_build_brief.md`](./docs/06_master_build_brief.md) | Ordered build phases for the complete feature set |

---

## License

MIT License.
