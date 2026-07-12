# Tracck — Environment & Secrets Specification

**Version:** 1.0  
**Updated:** June 2026

All secrets are managed per environment: `development`, `staging`, `production`.  
**Never commit any value from this document to version control.**

---

## 1. Environment Files

```
.env.local          ← Development only (gitignored)
.env.staging        ← Staging (gitignored, injected by CI)
.env.production     ← Production (gitignored, set in Vercel + Railway dashboards)
```

`.env.example` should be committed with all keys but no values:

```bash
# Copy and fill in values
cp .env.example .env.local
```

---

## 2. Vercel (Frontend + API Routes)

Set these in **Vercel Dashboard → Project → Settings → Environment Variables**.

### 2.1 Supabase

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key (safe for browser) | Supabase Dashboard → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (never expose client-side) | Supabase Dashboard → Project Settings → API → service_role |

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Only use server-side in API routes.

---

### 2.2 Upstash Redis (Rate Limiting)

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash REST endpoint | Upstash Console → Database → REST API → Endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Auth token for REST API | Upstash Console → Database → REST API → Token |

```env
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AX4xACQg...
```

---

### 2.3 App Config

| Variable | Required | Description | Value |
|----------|----------|-------------|-------|
| `NEXT_PUBLIC_APP_URL` | ✅ | Full public URL of the app | `https://tracck.io` (prod) or `http://localhost:3000` (dev) |
| `ADMIN_API_KEY` | ✅ | Shared secret for internal job trigger endpoints | Generate: `openssl rand -hex 32` |
| `OAUTH_STATE_SECRET` | ✅ | Signs OAuth state tokens to prevent CSRF | Generate: `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | ✅ | AES-256-GCM key for encrypting OAuth tokens at rest | Generate: `openssl rand -hex 32` (must be 64 hex chars = 32 bytes) |

```env
NEXT_PUBLIC_APP_URL=https://tracck.io
ADMIN_API_KEY=b1a2c3d4e5f6...
OAUTH_STATE_SECRET=7a8b9c0d1e2f...
ENCRYPTION_KEY=3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b
```

---

### 2.4 OAuth — GitHub

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth App Client ID | GitHub → Settings → Developer settings → OAuth Apps → New OAuth App |
| `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth App Client Secret | Same as above → Generate client secret |

```env
GITHUB_CLIENT_ID=Iv1.a1b2c3d4e5f6
GITHUB_CLIENT_SECRET=g7h8i9j0k1l2m3n4o5p6q7r8s9t0...
```

**GitHub App setup:**
- Application name: `Tracck`
- Homepage URL: `https://tracck.io`
- Authorization callback URL: `https://tracck.io/api/auth/oauth/callback?platform=github`
- Scopes required: `read:user`, `public_repo`

---

### 2.5 OAuth — X (Twitter)

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `TWITTER_CLIENT_ID` | ✅ | Twitter OAuth 2.0 Client ID | developer.twitter.com → Apps → Your App → Keys and Tokens |
| `TWITTER_CLIENT_SECRET` | ✅ | Twitter OAuth 2.0 Client Secret | Same location |

```env
TWITTER_CLIENT_ID=VjFLSz...
TWITTER_CLIENT_SECRET=a1b2c3d4e5f6g7h8i9j0...
```

**Twitter App setup:**
- App type: `Web App`
- Callback URL: `https://tracck.io/api/auth/oauth/callback?platform=twitter`
- Scopes: `tweet.read`, `users.read`, `offline.access`
- Required tier: Basic (for timeline API access)

---

### 2.6 OAuth — LinkedIn

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `LINKEDIN_CLIENT_ID` | ⚠️ Phase 2 | LinkedIn App Client ID | LinkedIn Developer Portal → Apps → Your App → Auth |
| `LINKEDIN_CLIENT_SECRET` | ⚠️ Phase 2 | LinkedIn App Client Secret | Same location |

```env
LINKEDIN_CLIENT_ID=86abc...
LINKEDIN_CLIENT_SECRET=xyz123...
```

> ⚠️ LinkedIn API is restricted. Phase 1 uses manual import. These vars are optional for Phase 1.  
> Required scopes: `w_member_social`, `r_basicprofile`

---

### 2.7 OAuth — Figma

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `FIGMA_CLIENT_ID` | ⚠️ Phase 2 | Figma OAuth App Client ID | Figma Account Settings → Applications → Create new app |
| `FIGMA_CLIENT_SECRET` | ⚠️ Phase 2 | Figma OAuth App Client Secret | Same location |

```env
FIGMA_CLIENT_ID=...
FIGMA_CLIENT_SECRET=...
```

Callback URL: `https://tracck.io/api/auth/oauth/callback?platform=figma`

---

### 2.8 Resend (Email)

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `RESEND_API_KEY` | ✅ | Resend transactional email API key | resend.com → Dashboard → API Keys → Create API Key |
| `RESEND_FROM_EMAIL` | ✅ | Verified sender address | Must be on a verified domain in Resend |

```env
RESEND_API_KEY=re_abc123...
RESEND_FROM_EMAIL=noreply@tracck.io
```

**Domain setup:** Add Resend DNS records to your domain registrar (MX, SPF, DKIM).

---

## 3. Railway (Workers)

Set these in **Railway Dashboard → Your Service → Variables**.

### 3.1 Supabase (same as Vercel, server-only)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Same value as `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Same value as Vercel |

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

### 3.2 Upstash Redis (BullMQ Queue)

BullMQ requires a standard Redis connection string, not Upstash REST API.

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `REDIS_URL` | ✅ | Upstash Redis connection string | Upstash Console → Database → Connection → Node.js (redis://) |

```env
REDIS_URL=redis://default:AX4xACQg...@your-db.upstash.io:6379
```

> Upstash provides both REST API (for Vercel edge) and Redis protocol (for Railway workers). You need both separately.

---

### 3.3 Google Gemini API

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `GEMINI_API_KEY` | ✅ | Gemini API key | aistudio.google.com/app/apikey → Create API key |

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

**Recommended:** Create a separate API key for production vs. development.  
**Model used:** `gemini-flash-latest` (set as constant in `workers/lib/gemini.ts`, not env var)

---

### 3.4 Platform API Keys (for Workers)

Same OAuth secrets as Vercel, but without `NEXT_PUBLIC_` prefixes:

| Variable | Required | Source |
|----------|----------|--------|
| `GITHUB_CLIENT_ID` | ✅ | Same as Vercel |
| `GITHUB_CLIENT_SECRET` | ✅ | Same as Vercel |
| `TWITTER_CLIENT_ID` | ✅ | Same as Vercel |
| `TWITTER_CLIENT_SECRET` | ✅ | Same as Vercel |
| `ENCRYPTION_KEY` | ✅ | Same as Vercel — used to decrypt stored tokens |

---

### 3.5 Worker Config

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `ADMIN_API_KEY` | ✅ | Must match Vercel value — used to call `/api/jobs/trigger` | — |
| `NEXT_PUBLIC_APP_URL` | ✅ | Used to call Vercel API routes from Railway | `https://tracck.io` |
| `SOCIAL_FETCH_CRON` | ✅ | CRON expression for daily social fetch | `0 3 * * *` (3am UTC) |
| `AI_BATCH_SIZE` | optional | Posts per Gemini extraction batch | `50` |
| `AI_CONFIDENCE_THRESHOLD` | optional | Minimum score before bullet is auto-pending | `0.7` |
| `WORKER_LOG_LEVEL` | optional | Log level for worker processes | `info` |

```env
ADMIN_API_KEY=b1a2c3d4e5f6...
NEXT_PUBLIC_APP_URL=https://tracck.io
SOCIAL_FETCH_CRON=0 3 * * *
AI_BATCH_SIZE=50
AI_CONFIDENCE_THRESHOLD=0.7
WORKER_LOG_LEVEL=info
```

---

## 4. Supabase Dashboard Settings

These are configured in the Supabase dashboard, not as env vars.

### 4.1 Auth Providers

Go to **Supabase Dashboard → Auth → Providers**:

| Provider | Enable | Client ID Var | Client Secret Var |
|----------|--------|---------------|-------------------|
| Email | ✅ | — | — |
| Google | ✅ Phase 2 | `GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_SECRET` |

### 4.2 Auth Redirect URLs

**Supabase Dashboard → Auth → URL Configuration:**

```
Site URL:        https://tracck.io
Redirect URLs:
  https://tracck.io/app/callback
  http://localhost:3000/app/callback   ← dev only
```

### 4.3 Database Webhooks

**Supabase Dashboard → Database → Webhooks → Create Webhook:**

| Setting | Value |
|---------|-------|
| Name | `notify_raw_posts_insert` |
| Table | `raw_posts` |
| Events | `INSERT` |
| URL | `https://your-railway-service.railway.app/api/jobs/webhook/db` |
| HTTP Method | `POST` |
| Headers | `X-Admin-Key: {ADMIN_API_KEY}` |

---

## 5. Complete `.env.example`

```env
# ─── Supabase ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ─── Upstash Redis (Vercel — REST API for rate limiting) ─────────────────────
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ─── Upstash Redis (Railway — Redis protocol for BullMQ) ─────────────────────
REDIS_URL=

# ─── Google Gemini (Railway workers only) ────────────────────────────────────
GEMINI_API_KEY=

# ─── App Config ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=
ADMIN_API_KEY=
OAUTH_STATE_SECRET=
ENCRYPTION_KEY=

# ─── GitHub OAuth ────────────────────────────────────────────────────────────
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ─── X (Twitter) OAuth ───────────────────────────────────────────────────────
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=

# ─── LinkedIn OAuth (Phase 2) ────────────────────────────────────────────────
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# ─── Figma OAuth (Phase 2) ───────────────────────────────────────────────────
FIGMA_CLIENT_ID=
FIGMA_CLIENT_SECRET=

# ─── Email ───────────────────────────────────────────────────────────────────
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# ─── Worker Config (Railway only) ────────────────────────────────────────────
SOCIAL_FETCH_CRON=0 3 * * *
AI_BATCH_SIZE=50
AI_CONFIDENCE_THRESHOLD=0.7
WORKER_LOG_LEVEL=info
```

---

## 6. Secret Generation Commands

```bash
# ADMIN_API_KEY
openssl rand -hex 32

# OAUTH_STATE_SECRET
openssl rand -hex 32

# ENCRYPTION_KEY (must be 64 hex chars = 32 bytes for AES-256)
openssl rand -hex 32
```

---

## 7. Environment-Specific Values

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://staging.tracck.io` | `https://tracck.io` |
| `SOCIAL_FETCH_CRON` | `*/5 * * * *` (every 5 min for testing) | `0 6 * * *` | `0 3 * * *` |
| `AI_CONFIDENCE_THRESHOLD` | `0.5` | `0.6` | `0.7` |
| `WORKER_LOG_LEVEL` | `debug` | `info` | `warn` |

---

## 8. Secret Rotation Policy

| Secret | Rotation Frequency | Who Rotates |
|--------|--------------------|-------------|
| `GEMINI_API_KEY` | On suspected compromise or quarterly | Engineering lead |
| `SUPABASE_SERVICE_ROLE_KEY` | On team member offboarding | Engineering lead |
| `GITHUB_CLIENT_SECRET` | Annually | Engineering lead |
| `TWITTER_CLIENT_SECRET` | Annually | Engineering lead |
| `ENCRYPTION_KEY` | ⚠️ Requires re-encrypting all stored tokens — plan carefully | Engineering lead |
| `ADMIN_API_KEY` | On suspected compromise | Engineering lead |

> ⚠️ Rotating `ENCRYPTION_KEY` requires a migration script to re-encrypt all rows in `connected_accounts`. Plan a maintenance window.

---

## 9. Access Control Summary

| Secret | Vercel | Railway | Shared with team? |
|--------|--------|---------|-------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | No — inject via dashboard only |
| `GEMINI_API_KEY` | ❌ | ✅ | No |
| `ENCRYPTION_KEY` | ✅ | ✅ | No — must match across both |
| `GITHUB_CLIENT_SECRET` | ✅ | ✅ | No |
| `TWITTER_CLIENT_SECRET` | ✅ | ✅ | No |
| `RESEND_API_KEY` | ✅ | ❌ | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ❌ | Yes — it's public by design |
| `NEXT_PUBLIC_APP_URL` | ✅ | ✅ | Yes — not a secret |
