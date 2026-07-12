# Tracck — System Design Document

**Version:** 1.0  
**Status:** Draft  
**Date:** June 2026

---

## 1. Overview

Tracck is a multi-service web application split across three deployment targets:

| Target | Service | Runtime |
|--------|---------|---------|
| Vercel | Next.js 14 frontend + API Routes | Node.js 20 |
| Railway | BullMQ worker processes | Node.js 20 |
| Supabase | PostgreSQL database + Auth + Storage | Managed |

External dependencies: Google Gemini API, X API v2, GitHub API, LinkedIn API, Figma API, Upstash Redis, Resend.

---

## 2. High-Level Architecture

```mermaid
graph TB
    subgraph Client["Browser / Client"]
        UI[Next.js App]
    end

    subgraph Vercel["Vercel — Frontend + API"]
        NEXT[Next.js 14<br/>App Router]
        APIROUTES[API Routes<br/>/api/*]
    end

    subgraph Railway["Railway — Workers"]
        WORKER[BullMQ Worker<br/>Processes]
        JOBS[Queue Handlers<br/>social-fetch<br/>ai-extraction<br/>resume-build<br/>notification<br/>ats-score]
    end

    subgraph Supabase["Supabase"]
        DB[(PostgreSQL)]
        AUTH[Auth]
        STORAGE[Storage<br/>PDFs / DOCXs]
        REALTIME[Realtime<br/>Webhooks]
    end

    subgraph Redis["Upstash Redis"]
        QUEUE[(BullMQ Queues)]
    end

    subgraph External["External APIs"]
        GEMINI[Google<br/>Gemini API]
        XAPI[X API v2]
        GHAPI[GitHub API]
        LIAPI[LinkedIn API]
        FIGMA[Figma API]
        RESEND[Resend<br/>Email]
    end

    UI --> NEXT
    NEXT --> APIROUTES
    APIROUTES --> DB
    APIROUTES --> AUTH
    APIROUTES --> QUEUE
    REALTIME -->|DB webhook| QUEUE
    QUEUE --> WORKER
    WORKER --> JOBS
    JOBS --> GEMINI
    JOBS --> XAPI
    JOBS --> GHAPI
    JOBS --> LIAPI
    JOBS --> FIGMA
    JOBS --> DB
    JOBS --> STORAGE
    JOBS --> RESEND
```

---

## 3. Component Breakdown

### 3.1 Next.js Frontend (Vercel)

**Role:** UI rendering, user-facing API, OAuth callback handling, session management.

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── callback/[provider]/page.tsx   ← OAuth return landing
├── (app)/
│   ├── dashboard/page.tsx
│   ├── accounts/page.tsx              ← Connect social accounts
│   ├── accomplishments/page.tsx       ← Confirmation feed
│   ├── resume/
│   │   ├── page.tsx                   ← Live resume preview
│   │   └── [version]/page.tsx
│   └── settings/page.tsx
├── api/
│   ├── auth/[...supabase]/route.ts
│   ├── accounts/route.ts
│   ├── accomplishments/route.ts
│   ├── resumes/route.ts
│   └── jobs/trigger/route.ts
└── middleware.ts                       ← Auth guard on /app/*
```

**Middleware:** All `/app/*` routes check Supabase session. Redirect to `/login` if unauthenticated.

### 3.2 BullMQ Workers (Railway)

**Role:** All async, long-running, or rate-limited work. Completely decoupled from the UI.

```
workers/
├── index.ts                 ← Worker bootstrap, connects to Upstash Redis
├── queues.ts                ← Queue definitions (shared with API routes)
├── jobs/
│   ├── social-fetch.ts      ← Pulls posts from social platforms
│   ├── ai-extraction.ts     ← Runs Gemini signal detection + bullet gen
│   ├── resume-build.ts      ← Assembles resume, generates PDF/DOCX
│   ├── notification.ts      ← Sends email/push on new accomplishments
│   └── ats-score.ts         ← Scores resume after build
└── lib/
    ├── platforms/           ← Per-platform fetch adapters
    │   ├── twitter.ts
    │   ├── github.ts
    │   ├── linkedin.ts
    │   └── figma.ts
    ├── gemini.ts            ← Google Gemini wrapper
    └── resume-export.ts     ← Puppeteer (PDF) + docx-js (DOCX)
```

### 3.3 Supabase

**Role:** Primary datastore, auth, file storage, and change-event source.

- **Auth:** Supabase Auth with email/password + Google OAuth. JWTs passed in `Authorization` header to API routes.
- **Database:** PostgreSQL 15. Row Level Security enforces user data isolation at the DB layer.
- **Storage:** Two buckets — `resumes` (private, user-scoped) and `exports` (signed URLs for downloads).
- **Webhooks:** Database webhooks fire on `raw_posts` INSERT → POST to a Railway webhook endpoint → enqueues `ai-extraction` job.

### 3.4 Upstash Redis + BullMQ

**Role:** Durable job queue with retry, delay, and priority support.

Queues:

| Queue | Concurrency | Max Retries | Backoff |
|-------|-------------|-------------|---------|
| `social-fetch` | 5 | 3 | Exponential 30s |
| `ai-extraction` | 10 | 5 | Exponential 10s |
| `resume-build` | 3 | 3 | Fixed 15s |
| `notification` | 20 | 2 | Fixed 5s |
| `ats-score` | 5 | 3 | Exponential 10s |

---

## 4. Data Flow Diagrams

### 4.1 User Onboarding & First Resume

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as API Routes
    participant DB as Supabase DB
    participant Q as BullMQ Queue
    participant W as Worker

    User->>UI: Sign up (email or Google)
    UI->>API: POST /api/auth/signup
    API->>DB: Insert users row
    DB-->>API: user_id
    API-->>UI: Session token

    User->>UI: Select role tags
    UI->>API: PATCH /api/users/roles
    API->>DB: Update users.role_tags

    User->>UI: Connect GitHub via OAuth
    UI->>API: POST /api/accounts/connect {platform: github, code}
    API->>DB: Insert connected_accounts row
    API->>Q: Enqueue social-fetch {user_id, platform: github}

    Q->>W: social-fetch job
    W->>W: Fetch last 90 days via GitHub API
    W->>DB: Bulk insert raw_posts
    DB->>Q: Webhook → Enqueue ai-extraction per batch

    Q->>W: ai-extraction job
    W->>W: Gemini Stage 1: signal detection
    W->>W: Gemini Stage 2: bullet generation
    W->>DB: Insert accomplishments (status: pending)
    W->>Q: Enqueue notification

    Q->>W: notification job
    W->>User: Email "New wins detected — confirm them"

    User->>UI: Open confirmation feed
    UI->>API: GET /api/accomplishments?status=pending
    API->>DB: Query accomplishments
    API-->>UI: Accomplishment cards

    User->>UI: Confirm 3 bullets
    UI->>API: PATCH /api/accomplishments/:id {status: confirmed}
    API->>DB: Update status, insert resume_bullets
    API->>Q: Enqueue resume-build (if 3+ confirmed)

    Q->>W: resume-build job
    W->>DB: Fetch all confirmed resume_bullets + user profile
    W->>W: Assemble resume document
    W->>W: Generate PDF (Puppeteer) + DOCX (docx-js)
    W->>DB: Insert resumes row with file URLs
    W->>Q: Enqueue ats-score

    Q->>W: ats-score job
    W->>DB: Fetch resume content
    W->>W: Score against 5 dimensions
    W->>DB: Update resumes.ats_score

    User->>UI: View + download resume
```

### 4.2 Social Fetch Pipeline (End-to-End)

```mermaid
flowchart TD
    CRON[Daily CRON<br/>Railway Scheduler] --> TRIGGER[Enqueue social-fetch<br/>for all active users]
    MANUAL[User clicks<br/>Sync Now] --> TRIGGER

    TRIGGER --> FETCH{Platform?}

    FETCH -->|X / Twitter| XW[Twitter Worker<br/>Timeline API v2<br/>paginate last 90d]
    FETCH -->|GitHub| GHW[GitHub Worker<br/>Events API + Repos API<br/>public activity]
    FETCH -->|LinkedIn| LIW[LinkedIn Worker<br/>w_member_social scope<br/>or manual import fallback]
    FETCH -->|Figma| FGW[Figma Worker<br/>Files API<br/>public files only]

    XW --> DEDUP[Deduplication<br/>Check post_id in raw_posts]
    GHW --> DEDUP
    LIW --> DEDUP
    FGW --> DEDUP

    DEDUP -->|New posts only| INSERT[Bulk INSERT raw_posts<br/>processed = false]
    DEDUP -->|Already seen| SKIP[Skip]

    INSERT --> WEBHOOK[Supabase DB Webhook<br/>fires on INSERT]
    WEBHOOK --> BATCH[Batch posts<br/>max 50 per job]
    BATCH --> AIQUEUE[Enqueue ai-extraction]

    AIQUEUE --> STAGE1[Gemini Stage 1<br/>Signal Detection<br/>Filter professional posts]
    STAGE1 --> QUALIFY{Has accomplishment<br/>signal?}
    QUALIFY -->|No| MARKPROC[Mark raw_post<br/>processed = true<br/>no_signal = true]
    QUALIFY -->|Yes| STAGE2[Gemini Stage 2<br/>Bullet Generation<br/>per qualifying post]

    STAGE2 --> CONFIDENCE{confidence_score<br/>≥ 0.7?}
    CONFIDENCE -->|No| LOWCONF[Insert accomplishment<br/>status = low_confidence<br/>surface for manual review]
    CONFIDENCE -->|Yes| INSERT2[Insert accomplishment<br/>status = pending]

    INSERT2 --> NOTIFY[Enqueue notification<br/>job]
    NOTIFY --> EMAIL[Send email to user<br/>via Resend]
```

### 4.3 Resume Build Pipeline

```mermaid
flowchart TD
    TRIGGER[resume-build job triggered<br/>on 3+ confirmed bullets] --> FETCH[Fetch from Supabase]

    FETCH --> PROFILE[users: name, email,<br/>location, role_tags]
    FETCH --> BULLETS[resume_bullets: all confirmed,<br/>ordered by position]
    FETCH --> SKILLS[skills: extracted + manual]
    FETCH --> EXP[User-entered experience<br/>education sections]

    PROFILE --> SUMMARY[Gemini Stage 3<br/>Generate 2-sentence summary<br/>based on role_tags + bullets]
    SUMMARY --> ASSEMBLE

    BULLETS --> ASSEMBLE[Assemble Resume Object<br/>in memory]
    SKILLS --> ASSEMBLE
    EXP --> ASSEMBLE

    ASSEMBLE --> ATSCHECK[ATS Compliance Check<br/>No tables / images / specials<br/>in content strings]

    ATSCHECK --> PDF[Puppeteer PDF<br/>Render headless HTML template<br/>→ PDF buffer]
    ATSCHECK --> DOCX[docx-js DOCX<br/>Programmatic .docx<br/>ATS-safe formatting]

    PDF --> STORE[Upload to Supabase Storage<br/>resumes/{user_id}/{version}/]
    DOCX --> STORE

    STORE --> DBROW[INSERT resumes row<br/>version++, pdf_url, docx_url]
    DBROW --> ATSJOB[Enqueue ats-score]

    ATSJOB --> SCORE[ATS Scoring Engine<br/>5 dimensions<br/>weighted average]
    SCORE --> UPDATE[UPDATE resumes.ats_score]
    UPDATE --> NOTIFY[Notify user<br/>Resume ready + score]
```

---

## 5. Authentication Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Next as Next.js Middleware
    participant Supabase

    Browser->>Next: GET /app/dashboard
    Next->>Next: Read session cookie
    Next->>Supabase: Verify JWT
    alt Valid session
        Supabase-->>Next: User payload
        Next-->>Browser: Render dashboard
    else No session / expired
        Next-->>Browser: Redirect to /login
    end

    Browser->>Next: POST /api/accounts/connect
    Next->>Next: middleware.ts extracts Bearer token
    Next->>Supabase: getUser(token)
    Supabase-->>Next: user_id
    Next->>Next: Inject user_id into request context
    Note over Next: All API routes receive verified user_id<br/>RLS enforces it at DB layer too
```

**Social OAuth flow (per platform):**

1. Browser → `GET /api/accounts/oauth/start?platform=github`
2. API generates state token, stores in Redis (TTL 10min)
3. Redirect to platform OAuth URL with `redirect_uri=/api/accounts/oauth/callback`
4. Platform redirects back with `code` + `state`
5. API validates state, exchanges code for access token
6. Store encrypted token in `connected_accounts.access_token`
7. Enqueue `social-fetch` job

---

## 6. Infrastructure Topology

```
┌─────────────────────────────────────────────────────────────┐
│  DNS: tracck.io → Vercel Edge Network                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Vercel (Frontend + API)                            │   │
│  │  • Next.js 14 App Router (SSR + RSC)                │   │
│  │  • API Routes — serverless functions                 │   │
│  │  • Automatic HTTPS, CDN, edge caching               │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │  Supabase (Managed PostgreSQL + Auth + Storage)     │   │
│  │  Region: africa-south1 (closest to NG)              │   │
│  │  • Connection pooling via Supavisor                  │   │
│  │  • Realtime webhooks → Railway                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Railway (Workers)                                  │   │
│  │  • BullMQ worker processes (always-on)              │   │
│  │  • Webhook receiver endpoint                        │   │
│  │  • Daily CRON scheduler                             │   │
│  │  • Horizontal scaling per queue concurrency         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Upstash Redis (Serverless Redis)                   │   │
│  │  • BullMQ queue persistence                         │   │
│  │  • OAuth state tokens (TTL)                         │   │
│  │  • Rate limit counters per platform                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend hosting | Vercel | Zero-config Next.js, automatic edge deployment |
| Worker hosting | Railway | Always-on processes; BullMQ needs persistent connections |
| Queue backend | Upstash Redis | Serverless Redis with REST API; no infra to manage |
| Database | Supabase PostgreSQL | RLS for multi-tenancy, built-in auth, realtime webhooks |
| AI provider | Google Gemini (`gemini-flash-latest`) | Structured JSON output reliability, instruction following |
| PDF generation | Puppeteer on Railway | Server-side only; can't run in Vercel serverless |
| DOCX generation | docx-js | Pure Node.js, no LibreOffice dependency |
| Token encryption | AES-256-GCM in app layer | Don't rely solely on Supabase RLS for OAuth secrets |
| Social fetch cadence | Daily + on-demand | Balance freshness vs. API rate limits |
| LinkedIn fallback | Manual PDF import | LinkedIn API is too restricted for programmatic access |

---

## 8. Error Handling & Resilience

### Worker Error Strategy

```
Job fails
  └─ BullMQ retries (exponential backoff, see concurrency table)
       └─ Max retries exceeded
            └─ Job moved to {queueName}:failed
                 └─ Admin webhook → Slack alert
                      └─ Manual investigation via Bull Board UI
```

### Platform API Failures

- **Rate limit hit (429):** Job is delayed (not failed) until the rate limit window resets. Counter stored in Redis.
- **Auth token expired:** Job moves to `needs_reauth` state, user notified to reconnect account.
- **Platform API down:** Job retried with exponential backoff; after max retries, user notified.

### Gemini API Failures

- **Timeout > 30s:** Retry with same prompt up to 3 times.
- **Invalid JSON output:** Retry with stricter JSON-only system prompt.
- **Low confidence score (< 0.7):** Insert accomplishment as `low_confidence`, surface for manual user review rather than dropping.

---

## 9. Security Considerations

- **OAuth tokens** encrypted at rest with AES-256-GCM before storing in `connected_accounts`. Decryption key stored in Railway env, never in Supabase.
- **RLS policies** on every table ensure users can only read/write their own rows even if API is bypassed.
- **No private social data** stored. Only public post content fetched via public APIs.
- **Signed URLs** for resume downloads (Supabase Storage signed URLs, 1hr TTL).
- **CORS** restricted to `tracck.io` origin on all API routes.
- **Rate limiting** on API routes via Upstash Redis (`@upstash/ratelimit`) — 100 req/min per user.
