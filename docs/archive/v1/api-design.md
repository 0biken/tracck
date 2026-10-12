# Tracck — API Design Specification

**Version:** 1.0  
**Base URL:** `https://tracck.io/api`  
**Auth:** Bearer token (Supabase JWT) in `Authorization` header on all protected routes.

---

## 1. Auth Middleware

Every API route (except `/api/auth/*`) runs through a shared middleware:

```typescript
// lib/auth.ts
import { createServerClient } from '@supabase/ssr';

export async function requireAuth(request: Request): Promise<{ user_id: string }> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Missing token');

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: {} }
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, 'INVALID_TOKEN', 'Token invalid or expired');

  return { user_id: data.user.id };
}
```

---

## 2. Standard Response Envelope

All endpoints return this shape:

```typescript
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",      // machine-readable
    "message": "Human message",
    "details": { ... }         // optional, validation errors etc.
  }
}
```

---

## 3. Error Codes Reference

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid request body or params |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 401 | `INVALID_TOKEN` | Token expired or malformed |
| 403 | `FORBIDDEN` | Authenticated but accessing another user's data |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 409 | `CONFLICT` | Duplicate (e.g. account already connected) |
| 422 | `UNPROCESSABLE` | Request valid but business rule fails |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 502 | `UPSTREAM_ERROR` | External API failure (Gemini, GitHub, etc.) |
| 503 | `QUEUE_UNAVAILABLE` | Redis/BullMQ connection failed |

```typescript
// lib/errors.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function errorResponse(err: ApiError | Error): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { success: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status }
    );
  }
  return Response.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
    { status: 500 }
  );
}
```

---

## 4. Endpoints

---

### 4.1 Auth

#### `POST /api/auth/signup`
Creates a new user account.

**Request:**
```json
{
  "email": "string",
  "password": "string",
  "name": "string"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "email": "string",
    "session": {
      "access_token": "string",
      "refresh_token": "string",
      "expires_at": 1234567890
    }
  }
}
```

**Errors:** `400 VALIDATION_ERROR`, `409 CONFLICT` (email already exists)

---

#### `POST /api/auth/login`
Email/password login.

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "session": {
      "access_token": "string",
      "refresh_token": "string",
      "expires_at": 1234567890
    }
  }
}
```

**Errors:** `401 UNAUTHORIZED` (wrong credentials)

---

#### `POST /api/auth/refresh`
Refresh an expired access token.

**Request:**
```json
{
  "refresh_token": "string"
}
```

**Response `200`:** Same as login.

---

#### `POST /api/auth/logout`
Invalidates current session.

**Auth:** Required

**Response `200`:**
```json
{ "success": true, "data": { "message": "Logged out" } }
```

---

#### `GET /api/auth/oauth/start`
Initiates OAuth flow for a social platform.

**Auth:** Required  
**Query params:**

| Param | Type | Required | Values |
|-------|------|----------|--------|
| `platform` | string | yes | `github`, `twitter`, `linkedin`, `figma` |

**Response `302`:** Redirect to platform OAuth URL.

---

#### `GET /api/auth/oauth/callback`
OAuth return handler. Called by platform after user authorizes.

**Query params:** `code`, `state`, `platform`

**Response `302`:** Redirect to `/app/accounts?connected=true` or `/app/accounts?error=oauth_failed`

---

### 4.2 Users

#### `GET /api/users/me`
Returns current user's profile.

**Auth:** Required

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "string",
    "name": "string",
    "role_tags": ["developer", "devrel"],
    "created_at": "ISO8601"
  }
}
```

---

#### `PATCH /api/users/me`
Update user profile or role tags.

**Auth:** Required

**Request:**
```json
{
  "name": "string",
  "role_tags": ["developer", "ui_designer"]
}
```

All fields optional. `role_tags` values: `developer`, `devrel`, `smm`, `virtual_assistant`, `ui_designer`, `data_analyst`.

**Response `200`:** Updated user object (same shape as GET).

**Errors:** `400 VALIDATION_ERROR`

---

### 4.3 Connected Accounts

#### `GET /api/accounts`
List all connected social accounts for the current user.

**Auth:** Required

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "uuid",
        "platform": "github",
        "username": "saintEvan",
        "connected_at": "ISO8601",
        "last_synced_at": "ISO8601",
        "status": "active"
      }
    ]
  }
}
```

`status` values: `active`, `token_expired`, `error`

---

#### `DELETE /api/accounts/:id`
Disconnect a social account. Removes stored token.

**Auth:** Required

**Response `200`:**
```json
{ "success": true, "data": { "message": "Account disconnected" } }
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

---

#### `POST /api/accounts/:id/sync`
Manually trigger a social fetch for one account.

**Auth:** Required

**Response `202`:**
```json
{
  "success": true,
  "data": {
    "job_id": "string",
    "queue": "social-fetch",
    "message": "Sync queued"
  }
}
```

**Errors:** `404 NOT_FOUND`, `429 RATE_LIMITED` (if sync triggered < 1hr ago)

---

#### `POST /api/accounts/import/linkedin`
Manual LinkedIn import — paste or upload LinkedIn data export.

**Auth:** Required  
**Content-Type:** `multipart/form-data`

**Request:**
```
file: File (PDF or JSON from LinkedIn data export)
```

**Response `202`:**
```json
{
  "success": true,
  "data": {
    "job_id": "string",
    "message": "LinkedIn data queued for processing"
  }
}
```

---

### 4.4 Raw Posts

#### `GET /api/posts`
List raw posts fetched from connected accounts.

**Auth:** Required  
**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `platform` | string | all | Filter by platform |
| `processed` | boolean | — | Filter by processed status |
| `limit` | integer | 50 | Max results |
| `cursor` | string | — | Pagination cursor |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "uuid",
        "platform": "github",
        "post_id": "string",
        "content": "string",
        "posted_at": "ISO8601",
        "processed": true,
        "has_signal": true
      }
    ],
    "next_cursor": "string | null"
  }
}
```

---

### 4.5 Accomplishments

#### `GET /api/accomplishments`
List AI-extracted accomplishments.

**Auth:** Required  
**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | all | `pending`, `confirmed`, `dismissed`, `low_confidence` |
| `role_tag` | string | all | Filter by role category |
| `limit` | integer | 20 | Max results |
| `cursor` | string | — | Pagination cursor |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "accomplishments": [
      {
        "id": "uuid",
        "raw_post": {
          "id": "uuid",
          "platform": "github",
          "content": "string (truncated to 280 chars)",
          "posted_at": "ISO8601"
        },
        "extracted_text": "string",
        "bullet_text": "Deployed a REST API serving 200+ daily active users using Node.js and Supabase",
        "role_tag": "developer",
        "ats_keywords": ["deployed", "REST API", "Node.js", "Supabase"],
        "metric_flag": true,
        "confidence_score": 0.91,
        "status": "pending",
        "detected_at": "ISO8601"
      }
    ],
    "counts": {
      "pending": 4,
      "confirmed": 12,
      "dismissed": 3,
      "low_confidence": 2
    },
    "next_cursor": "string | null"
  }
}
```

---

#### `PATCH /api/accomplishments/:id`
Confirm, dismiss, or update an accomplishment.

**Auth:** Required

**Request:**
```json
{
  "status": "confirmed",
  "bullet_text": "Optional edited bullet text"
}
```

`status` values: `confirmed`, `dismissed`

**Side effects on `confirmed`:**
- Inserts row into `resume_bullets`
- If total confirmed bullets ≥ 3, enqueues `resume-build` job

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "confirmed",
    "bullet_text": "string",
    "resume_build_triggered": true
  }
}
```

**Errors:** `404 NOT_FOUND`, `409 CONFLICT` (already confirmed/dismissed)

---

#### `PATCH /api/accomplishments/bulk`
Bulk update multiple accomplishments.

**Auth:** Required

**Request:**
```json
{
  "ids": ["uuid", "uuid"],
  "status": "dismissed"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "updated_count": 2
  }
}
```

---

### 4.6 Resume Bullets

#### `GET /api/bullets`
List confirmed resume bullets for the current user.

**Auth:** Required  
**Query params:** `role_tag` (optional filter)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "bullets": [
      {
        "id": "uuid",
        "bullet_text": "string",
        "role_tag": "developer",
        "ats_keywords": ["string"],
        "position": 0,
        "source": {
          "platform": "github",
          "posted_at": "ISO8601"
        }
      }
    ]
  }
}
```

---

#### `PATCH /api/bullets/:id`
Edit a resume bullet or change its position.

**Auth:** Required

**Request:**
```json
{
  "bullet_text": "string",
  "position": 2
}
```

**Response `200`:** Updated bullet object.

---

#### `DELETE /api/bullets/:id`
Remove a bullet from the resume. Does not change accomplishment status.

**Auth:** Required

**Response `200`:**
```json
{ "success": true, "data": { "message": "Bullet removed" } }
```

---

### 4.7 Resumes

#### `GET /api/resumes`
List all resume versions for the current user.

**Auth:** Required

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "resumes": [
      {
        "id": "uuid",
        "version": 3,
        "generated_at": "ISO8601",
        "ats_score": 84,
        "pdf_url": "https://... (signed, expires in 1hr)",
        "docx_url": "https://... (signed, expires in 1hr)",
        "bullet_count": 14
      }
    ]
  }
}
```

---

#### `GET /api/resumes/latest`
Returns the most recent resume version with fresh signed URLs.

**Auth:** Required

**Response `200`:** Single resume object (same shape as above).

---

#### `POST /api/resumes/build`
Manually trigger a resume rebuild.

**Auth:** Required

**Response `202`:**
```json
{
  "success": true,
  "data": {
    "job_id": "string",
    "message": "Resume build queued"
  }
}
```

**Errors:** `422 UNPROCESSABLE` if fewer than 3 confirmed bullets exist.

---

#### `GET /api/resumes/:id/preview`
Returns a JSON representation of the resume content (for live preview rendering in the UI).

**Auth:** Required

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "header": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "location": "string",
      "linkedin": "string",
      "github": "string"
    },
    "summary": "string",
    "skills": ["string"],
    "experience": [
      {
        "company": "string",
        "role": "string",
        "start_date": "string",
        "end_date": "string | null",
        "bullets": ["string"]
      }
    ],
    "accomplishments": [
      {
        "bullet_text": "string",
        "role_tag": "string"
      }
    ],
    "education": [
      {
        "institution": "string",
        "degree": "string",
        "year": "string"
      }
    ],
    "ats_score": 84
  }
}
```

---

### 4.8 Skills

#### `GET /api/skills`
List skills for the current user.

**Auth:** Required

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "skills": [
      {
        "id": "uuid",
        "skill_name": "React",
        "source": "github",
        "proficiency": "intermediate"
      }
    ]
  }
}
```

---

#### `POST /api/skills`
Manually add a skill.

**Auth:** Required

**Request:**
```json
{
  "skill_name": "Figma",
  "proficiency": "advanced"
}
```

`proficiency` values: `beginner`, `intermediate`, `advanced`, `expert`

**Response `201`:** New skill object.

---

#### `DELETE /api/skills/:id`
Remove a skill.

**Auth:** Required

**Response `200`:**
```json
{ "success": true, "data": { "message": "Skill removed" } }
```

---

### 4.9 Jobs (Internal / Admin)

> These routes are internal — protected by an admin-only API key, not user JWTs.

**Auth header:** `X-Admin-Key: {ADMIN_API_KEY}` (Railway env var)

---

#### `POST /api/jobs/trigger`
Manually enqueue a job. Used by Railway CRON and Supabase webhooks.

**Request:**
```json
{
  "queue": "social-fetch",
  "payload": {
    "user_id": "uuid",
    "platform": "github"
  }
}
```

**Response `202`:**
```json
{
  "success": true,
  "data": {
    "job_id": "string"
  }
}
```

**Errors:** `400 VALIDATION_ERROR` (invalid queue name or payload shape), `503 QUEUE_UNAVAILABLE`

---

#### `POST /api/jobs/webhook/db`
Receives Supabase DB webhook on `raw_posts` INSERT. Enqueues `ai-extraction` batch.

**Request (from Supabase):**
```json
{
  "type": "INSERT",
  "table": "raw_posts",
  "record": {
    "id": "uuid",
    "user_id": "uuid"
  }
}
```

**Response `200`:**
```json
{ "success": true, "data": { "queued": true } }
```

---

## 5. Rate Limits

All user-facing routes are rate-limited via Upstash Redis + `@upstash/ratelimit`:

| Route Group | Limit | Window |
|-------------|-------|--------|
| Auth endpoints | 10 requests | 1 minute |
| `GET` data endpoints | 100 requests | 1 minute |
| `POST /api/accounts/:id/sync` | 1 request | 1 hour |
| `POST /api/resumes/build` | 5 requests | 1 hour |
| All other write endpoints | 30 requests | 1 minute |

Rate limit response:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": {
      "retry_after": 45
    }
  }
}
```

Headers on all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
X-RateLimit-Reset: 1719351600
```

---

## 6. TypeScript Types Reference

```typescript
// types/api.ts

export type Platform = 'github' | 'twitter' | 'linkedin' | 'figma' | 'behance';

export type RoleTag =
  | 'developer'
  | 'devrel'
  | 'smm'
  | 'virtual_assistant'
  | 'ui_designer'
  | 'data_analyst';

export type AccomplishmentStatus =
  | 'pending'
  | 'confirmed'
  | 'dismissed'
  | 'low_confidence';

export type JobQueue =
  | 'social-fetch'
  | 'ai-extraction'
  | 'resume-build'
  | 'notification'
  | 'ats-score';

export interface Accomplishment {
  id: string;
  user_id: string;
  raw_post_id: string;
  extracted_text: string;
  bullet_text: string;
  role_tag: RoleTag;
  ats_keywords: string[];
  metric_flag: boolean;
  confidence_score: number;
  status: AccomplishmentStatus;
  detected_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  version: number;
  generated_at: string;
  pdf_url: string;
  docx_url: string;
  ats_score: number;
  bullet_count: number;
}

export interface JobPayload {
  'social-fetch': { user_id: string; platform: Platform };
  'ai-extraction': { user_id: string; post_ids: string[] };
  'resume-build': { user_id: string };
  'notification': { user_id: string; accomplishment_id: string };
  'ats-score': { user_id: string; resume_id: string };
}
```
