# Admin Portal (User & Platform Management)

Status: Implemented | Owner: Tracck Team | Last updated: 2026-11-01

## 1. Overview & Problem Statement

As Tracck onboards early-career talent (students, NYSC corps members, developers, designers), the founding and operations team needs a secure, built-in **Admin Portal** to observe platform health, support users, manage plans/quotas, and handle account lifecycle requests without running raw SQL queries against production PostgreSQL.

### Goals
1. **Visibility:** Give Tracck staff a real-time overview of user signups, onboarding completion, Pro subscriptions, connected sources, generated resumes, background job health, and AI usage/cost.
2. **User Management & Support:** Allow staff to search/filter users, inspect a user's full account state (profile, sources, resumes, jobs, billing, audit history), and perform support actions (grant/revoke Pro plan, reset monthly resume quota, suspend/unsuspend accounts, or trigger account deletion).
3. **Compliance & Auditing:** Track pending account deletion requests (`deletion_requests`), view waitlist entries (`org_waitlist`), and record every staff action in `audit_events`.

### Non-Goals
- B2B Organisation API key management (covered in [06-deferred-scope.md](06-deferred-scope.md)).
- Viewing or editing the private text of a user's resume bullets or raw CV files (staff see metadata, counts, and statuses only, preserving user privacy).

---

## 2. Access Control & Security

| Requirement | Specification |
|---|---|
| **Staff Identification** | Configured via environment variables in `backend/src/config/env.ts`: `STAFF_USER_IDS` (comma-separated UUIDs) and `STAFF_EMAILS` (comma-separated email addresses). Either match grants staff access. |
| **API Enforcement** | Every `/v1/admin/*` endpoint is protected by `AuthGuard` followed by `StaffGuard`. Non-staff requests receive `403 FORBIDDEN`. |
| **Frontend Visibility** | `MeView` includes `staff: boolean`. Only staff see the "Admin console" link in `SidebarNav` and can access `/admin/*` screens. |
| **Audit Logging** | Every mutating admin action (`admin.user_plan_changed`, `admin.user_suspended`, `admin.user_unsuspended`, `admin.user_quota_reset`, `admin.user_deletion_requested`) writes an immutable entry to `audit_events` with `actor = staffUserId`. |
| **Account Suspension** | Suspended accounts (`profiles.suspended_at IS NOT NULL`) are blocked at `AuthGuard` with `403 ACCOUNT_SUSPENDED`. |

---

## 3. Functional Requirements

### FR-A1: Platform Overview Dashboard (`/admin`)
- **User Counts:** Total users, onboarded users, active `pro` users, suspended users, new signups (last 7 days and 30 days).
- **Product Usage:** Total connected sources (with breakdown by provider), total evidence items, total resumes generated, total resumes exported.
- **System & AI Health:** Background jobs summary (`queued`, `running`, `succeeded`, `failed` in last 24h) and AI model calls (`llm_calls` count, total tokens, estimated USD cost in last 30 days).
- **Actionable Queues:** Count of open `deletion_requests` and total `org_waitlist` signups.

### FR-A2: User Directory (`/admin/users`)
- **Search (`q`):** Case-insensitive match against `display_name`, `auth.users.email`, or exact `id`.
- **Filters:** `plan` (`all` | `free` | `pro`), `status` (`all` | `active` | `suspended` | `onboarding`), `role` (`all` | `RoleId`).
- **Pagination:** Cursor-based (`Page<AdminUserSummaryView>`), ordered by `created_at DESC`.

### FR-A3: User Detail Inspector (`/admin/users/[userId]`)
1. **Profile & Identity:** User ID, email, display name, headline, location, phone, roles, onboarding status, policy consent status, joined timestamp, last sign-in timestamp, suspension state.
2. **Entitlements & Quota:** Current plan (`free` / `pro`), subscription status from `subscriptions`, resumes used this month vs. monthly allowance, active sources count.
3. **Tabbed Operational History:** Connected `source_connections`, generated `resume_documents` (metadata only), recent `background_jobs`, `payments`, and `audit_events`.

### FR-A4: User Management Actions
1. **Change Plan (`free` ↔ `pro`):** Updates `profiles.plan` and logs `admin.user_plan_changed`.
2. **Suspend / Unsuspend Account:** Sets or clears `profiles.suspended_at` and logs `admin.user_suspended` / `admin.user_unsuspended`. Self-suspension is prevented.
3. **Reset Monthly Resume Quota:** Sets the current period's `resumes` count in `usage_counters` to `0` and logs `admin.user_quota_reset`.
4. **Delete User Account:** Dispatches the `account_deletion` job via `PrivacyService.requestDeletion` and logs `admin.user_deletion_requested`.

### FR-A5: Activity, Deletions & Waitlist (`/admin/activity`)
- **Audit Log Tab:** Recent `audit_events` across the platform.
- **Deletion Requests Tab:** Open and completed `deletion_requests`.
- **Organisation Waitlist Tab:** Submissions in `org_waitlist`.

---

## 4. API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/admin/stats` | Platform KPIs, counts, job health, AI cost summary |
| `GET` | `/v1/admin/users` | Paginated user directory (`q`, `plan`, `status`, `role`, `cursor`, `limit`) |
| `GET` | `/v1/admin/users/:userId` | Full user detail inspector view |
| `PATCH` | `/v1/admin/users/:userId` | Update user `plan` (`free` \| `pro`) or `suspended` (`boolean`, `reason`) |
| `POST` | `/v1/admin/users/:userId/reset-quota` | Reset user's current month resume usage counter to `0` |
| `DELETE` | `/v1/admin/users/:userId` | Trigger account deletion job for the user |
| `GET` | `/v1/admin/audit` | Platform audit events (`userId`, `eventType`, `cursor`, `limit`) |
| `GET` | `/v1/admin/deletion-requests` | List account deletion requests |
| `GET` | `/v1/admin/waitlist` | List organisation waitlist entries |
