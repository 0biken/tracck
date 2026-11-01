import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  ApiError,
  POLICY_PURPOSES,
  POLICY_TEXT_VERSION,
  ROLE_IDS,
  entitlementsFor,
  type AdminAuditEventView,
  type AdminDeletionRequestView,
  type AdminStatsView,
  type AdminUpdateUserRequest,
  type AdminUserDetailView,
  type AdminUserStatus,
  type AdminUserSummaryView,
  type AdminWaitlistEntryView,
  type BillingView,
  type Page,
  type PlanId,
  type ResumeLength,
  type RoleId,
  type SourceProvider,
} from '@tracck/shared';
import type { ApiEnv } from '../config/env';
import { AuditService } from '../core/audit.service';
import { EntitlementsService, periodResetsOn, periodStart } from '../core/entitlements.service';
import type { Database } from '../db';
import {
  auditEvents,
  backgroundJobs,
  candidateEvidence,
  deletionRequests,
  orgWaitlist,
  payments,
  profiles,
  resumeDocuments,
  sourceConnections,
  subscriptions,
  usageCounters,
  userPolicyConsents,
} from '../db/schema';
import { PrivacyService } from '../privacy/privacy.service';
import { DB, ENV } from '../tokens';
import { isStaff } from './staff.guard';

const SOURCE_PROVIDERS: SourceProvider[] = ['github', 'cv', 'linkedin', 'portfolio', 'x', 'behance', 'manual'];

const isRole = (value: string): value is RoleId => (ROLE_IDS as readonly string[]).includes(value);

function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function userStatusOf(row: {
  suspended_at: Date | string | null;
  onboarding_completed_at: Date | string | null;
}): AdminUserStatus {
  if (row.suspended_at !== null) return 'suspended';
  if (row.onboarding_completed_at === null) return 'onboarding';
  return 'active';
}

export interface AdminUsersFilter {
  q?: string;
  plan?: PlanId;
  status?: AdminUserStatus;
  role?: RoleId;
  cursor?: string;
  limit?: number;
}

export interface AdminAuditFilter {
  userId?: string;
  eventType?: string;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PrivacyService) private readonly privacy: PrivacyService,
  ) {}

  // ─── Platform Overview Stats ───────────────────────────────────────────────

  async stats(now = new Date()): Promise<AdminStatsView> {
    const q = <T>(query: ReturnType<typeof sql>) => this.db.execute(query).then((res) => rowsOf<T>(res));
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

    const [userCounts, sourcesByProv, contentCounts, jobCounts, aiStats, queueCounts] = await Promise.all([
      q<{
        total: number;
        onboarded: number;
        pro: number;
        suspended: number;
        new_7d: number;
        new_30d: number;
      }>(sql`
        select count(*)::int as total,
               count(*) filter (where onboarding_completed_at is not null)::int as onboarded,
               count(*) filter (where plan = 'pro')::int as pro,
               count(*) filter (where suspended_at is not null)::int as suspended,
               count(*) filter (where created_at >= ${sevenDaysAgo})::int as new_7d,
               count(*) filter (where created_at >= ${thirtyDaysAgo})::int as new_30d
          from public.profiles
         where deleted_at is null
      `),
      q<{ provider: string; n: number }>(sql`
        select provider, count(*)::int as n
          from public.source_connections
         where revoked_at is null
         group by provider
      `),
      q<{ evidence_total: number; resumes_total: number; resumes_exported: number }>(sql`
        select (select count(*)::int from public.candidate_evidence) as evidence_total,
               (select count(*) filter (where status <> 'archived')::int from public.resume_documents) as resumes_total,
               (select count(*) filter (where last_exported_at is not null)::int from public.resume_documents) as resumes_exported
      `),
      q<{ queued: number; running: number; succeeded: number; failed: number }>(sql`
        select count(*) filter (where status in ('queued', 'retry_wait'))::int as queued,
               count(*) filter (where status = 'running')::int as running,
               count(*) filter (where status = 'succeeded' and created_at >= ${dayAgo})::int as succeeded,
               count(*) filter (where status = 'failed' and created_at >= ${dayAgo})::int as failed
          from public.background_jobs
      `),
      q<{
        calls: number;
        failed_calls: number;
        input_tokens: number;
        output_tokens: number;
        cost_usd: string;
      }>(sql`
        select count(*)::int as calls,
               count(*) filter (where status <> 'ok')::int as failed_calls,
               coalesce(sum(input_tokens), 0)::int as input_tokens,
               coalesce(sum(output_tokens), 0)::int as output_tokens,
               coalesce(sum(cost_estimate), 0)::text as cost_usd
          from public.llm_calls
         where created_at >= ${thirtyDaysAgo}
      `),
      q<{ open_deletions: number; waitlist_entries: number }>(sql`
        select (select count(*)::int from public.deletion_requests where status in ('requested', 'in_progress')) as open_deletions,
               (select count(*)::int from public.org_waitlist) as waitlist_entries
      `),
    ]);

    const byProvider = Object.fromEntries(SOURCE_PROVIDERS.map((p) => [p, 0])) as Record<SourceProvider, number>;
    let sourcesTotal = 0;
    for (const row of sourcesByProv) {
      sourcesTotal += row.n;
      if (row.provider in byProvider) {
        byProvider[row.provider as SourceProvider] = row.n;
      }
    }

    const u = userCounts[0];
    const c = contentCounts[0];
    const j = jobCounts[0];
    const a = aiStats[0];
    const qc = queueCounts[0];

    return {
      users: {
        total: u ? u.total : 0,
        onboarded: u ? u.onboarded : 0,
        pro: u ? u.pro : 0,
        suspended: u ? u.suspended : 0,
        newLast7d: u ? u.new_7d : 0,
        newLast30d: u ? u.new_30d : 0,
      },
      content: {
        sourcesTotal,
        sourcesByProvider: byProvider,
        evidenceTotal: c ? c.evidence_total : 0,
        resumesTotal: c ? c.resumes_total : 0,
        resumesExported: c ? c.resumes_exported : 0,
      },
      jobsLast24h: {
        queued: j ? j.queued : 0,
        running: j ? j.running : 0,
        succeeded: j ? j.succeeded : 0,
        failed: j ? j.failed : 0,
      },
      aiLast30d: {
        calls: a ? a.calls : 0,
        failedCalls: a ? a.failed_calls : 0,
        inputTokens: a ? a.input_tokens : 0,
        outputTokens: a ? a.output_tokens : 0,
        estimatedCostUsd: a ? Number(a.cost_usd) : 0,
      },
      queues: {
        openDeletionRequests: qc ? qc.open_deletions : 0,
        waitlistEntries: qc ? qc.waitlist_entries : 0,
      },
    };
  }

  // ─── User Directory ────────────────────────────────────────────────────────

  async users(filter: AdminUsersFilter = {}): Promise<Page<AdminUserSummaryView>> {
    const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
    const conditions = [sql`p.deleted_at is null`];

    if (filter.q) {
      const pattern = `%${filter.q.trim()}%`;
      conditions.push(
        sql`(p.display_name ilike ${pattern} or u.email ilike ${pattern} or p.id::text = ${filter.q.trim()})`,
      );
    }
    if (filter.plan) {
      conditions.push(sql`p.plan = ${filter.plan}`);
    }
    if (filter.role) {
      conditions.push(sql`(p.primary_role = ${filter.role} or ${filter.role} = any(p.preferred_roles))`);
    }
    if (filter.status === 'suspended') {
      conditions.push(sql`p.suspended_at is not null`);
    } else if (filter.status === 'onboarding') {
      conditions.push(sql`p.suspended_at is null and p.onboarding_completed_at is null`);
    } else if (filter.status === 'active') {
      conditions.push(sql`p.suspended_at is null and p.onboarding_completed_at is not null`);
    }
    if (filter.cursor) {
      conditions.push(sql`p.created_at < ${filter.cursor}`);
    }

    const whereClause = sql.join(conditions, sql` and `);

    type UserRow = {
      id: string;
      email: string | null;
      display_name: string | null;
      primary_role: string | null;
      preferred_roles: string[];
      plan: PlanId;
      onboarding_completed_at: Date | string | null;
      suspended_at: Date | string | null;
      created_at: Date | string;
      last_sign_in_at: Date | string | null;
      sources_count: number;
      resumes_count: number;
    };

    const rows = rowsOf<UserRow>(
      await this.db.execute(sql`
        select p.id,
               u.email,
               p.display_name,
               p.primary_role,
               p.preferred_roles,
               p.plan,
               p.onboarding_completed_at,
               p.suspended_at,
               p.created_at,
               u.last_sign_in_at,
               (select count(*)::int from public.source_connections sc where sc.user_id = p.id and sc.revoked_at is null) as sources_count,
               (select count(*)::int from public.resume_documents rd where rd.user_id = p.id and rd.status <> 'archived') as resumes_count
          from public.profiles p
          left join auth.users u on u.id = p.id
         where ${whereClause}
         order by p.created_at desc, p.id desc
         limit ${limit + 1}
      `),
    );

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map((row) => {
        const validRoles = (row.preferred_roles ?? []).filter(isRole);
        const primaryRole =
          row.primary_role && isRole(row.primary_role) ? row.primary_role : (validRoles[0] ?? null);
        return {
          id: row.id,
          email: row.email,
          name: row.display_name,
          primaryRole,
          plan: row.plan,
          status: userStatusOf(row),
          sourcesCount: row.sources_count,
          resumesCount: row.resumes_count,
          createdAt: toIso(row.created_at)!,
          lastSignInAt: toIso(row.last_sign_in_at),
          suspendedAt: toIso(row.suspended_at),
        };
      }),
      nextCursor: hasMore && last ? toIso(last.created_at) : null,
    };
  }

  // ─── User Detail Inspector ─────────────────────────────────────────────────

  async userDetail(userId: string, now = new Date()): Promise<AdminUserDetailView> {
    const [profile] = await this.db.select().from(profiles).where(eq(profiles.id, userId));
    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'We could not find that user.');
    }

    const [
      authRows,
      acceptedConsents,
      userSources,
      userResumes,
      userJobs,
      userPayments,
      userSub,
      evidenceCountRows,
      resumesThisMonth,
      activeSources,
      userAudits,
    ] = await Promise.all([
      this.db
        .execute(sql`select email, last_sign_in_at from auth.users where id = ${userId}`)
        .then((r) => rowsOf<{ email: string | null; last_sign_in_at: Date | string | null }>(r)),
      this.db
        .select({ purpose: userPolicyConsents.purpose })
        .from(userPolicyConsents)
        .where(and(eq(userPolicyConsents.userId, userId), eq(userPolicyConsents.textVersion, POLICY_TEXT_VERSION))),
      this.db
        .select()
        .from(sourceConnections)
        .where(and(eq(sourceConnections.userId, userId), isNull(sourceConnections.revokedAt)))
        .orderBy(desc(sourceConnections.createdAt)),
      this.db
        .select()
        .from(resumeDocuments)
        .where(eq(resumeDocuments.userId, userId))
        .orderBy(desc(resumeDocuments.createdAt))
        .limit(30),
      this.db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.userId, userId))
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(20),
      this.db
        .select()
        .from(payments)
        .where(eq(payments.userId, userId))
        .orderBy(desc(payments.createdAt))
        .limit(20),
      this.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.updatedAt))
        .limit(1),
      this.db
        .execute(sql`select count(*)::int as n from public.candidate_evidence where user_id = ${userId}`)
        .then((r) => rowsOf<{ n: number }>(r)),
      this.entitlements.resumesUsed(userId, now),
      this.entitlements.activeSources(userId),
      this.auditLog({ userId, limit: 30 }),
    ]);

    const authUser = authRows[0];
    const email = authUser ? authUser.email : null;
    const lastSignInAt = authUser ? toIso(authUser.last_sign_in_at) : null;
    const roles = profile.preferredRoles.filter(isRole);
    const primaryRole =
      profile.primaryRole && isRole(profile.primaryRole) ? profile.primaryRole : (roles[0] ?? null);
    const plan = profile.plan as PlanId;
    const entitlements = entitlementsFor(plan);
    const sub = userSub[0];

    return {
      id: profile.id,
      email,
      name: profile.displayName,
      headline: profile.headline,
      location: profile.location,
      phone: profile.phone,
      roles,
      primaryRole,
      plan,
      status: userStatusOf({
        suspended_at: profile.suspendedAt,
        onboarding_completed_at: profile.onboardingCompletedAt,
      }),
      onboardingCompleted: profile.onboardingCompletedAt !== null,
      policyAccepted: POLICY_PURPOSES.every((purpose) => acceptedConsents.some((row) => row.purpose === purpose)),
      staff: isStaff(this.env, profile.id, email),
      sourcesCount: userSources.length,
      resumesCount: userResumes.filter((r) => r.status !== 'archived').length,
      createdAt: profile.createdAt.toISOString(),
      lastSignInAt,
      suspendedAt: profile.suspendedAt ? profile.suspendedAt.toISOString() : null,
      usage: {
        resumesThisMonth,
        resumesLimit: entitlements.resumesPerMonth,
        activeSources,
        sourcesLimit: entitlements.maxSources,
        periodResetsOn: periodResetsOn(now),
        evidenceCount: evidenceCountRows[0] ? evidenceCountRows[0].n : 0,
      },
      subscription: {
        status: sub ? (sub.status as BillingView['status']) : 'none',
        currentPeriodEnd: sub && sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
        cancelAtPeriodEnd: sub ? sub.cancelAtPeriodEnd : false,
      },
      sources: userSources.map((s) => ({
        id: s.id,
        provider: s.provider,
        handle: s.displayHandle,
        status: s.status,
        lastSyncAt: s.lastSyncAt ? s.lastSyncAt.toISOString() : null,
        lastErrorCode: s.lastErrorCode,
        createdAt: s.createdAt.toISOString(),
      })),
      resumes: userResumes.map((r) => ({
        id: r.id,
        title: r.title,
        company: r.company,
        roleId: r.roleId,
        length: r.length as ResumeLength,
        status: r.status,
        engine: r.engine,
        createdAt: r.createdAt.toISOString(),
        lastExportedAt: r.lastExportedAt ? r.lastExportedAt.toISOString() : null,
      })),
      recentJobs: userJobs.map((j) => ({
        id: j.id,
        jobType: j.jobType,
        status: j.status,
        step: j.step,
        attemptCount: j.attemptCount,
        errorCode: j.errorCode,
        safeErrorMessage: j.safeErrorMessage,
        createdAt: j.createdAt.toISOString(),
        completedAt: j.completedAt ? j.completedAt.toISOString() : null,
      })),
      payments: userPayments.map((p) => ({
        id: p.id,
        provider: p.provider,
        reference: p.providerReference,
        amountMinor: Number(p.amountMinor),
        currency: p.currency,
        status: p.status,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
      })),
      auditEvents: userAudits.items,
    };
  }

  // ─── User Actions ──────────────────────────────────────────────────────────

  async updateUser(
    staffId: string,
    userId: string,
    input: AdminUpdateUserRequest,
  ): Promise<AdminUserDetailView> {
    const [existing] = await this.db.select().from(profiles).where(eq(profiles.id, userId));
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'We could not find that user.');
    }

    if (input.suspended === true && staffId === userId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'You cannot suspend your own account.');
    }

    const updates: Partial<typeof profiles.$inferInsert> = {};
    if (input.plan !== undefined && input.plan !== existing.plan) {
      updates.plan = input.plan;
    }
    if (input.suspended !== undefined) {
      const currentlySuspended = existing.suspendedAt !== null;
      if (input.suspended && !currentlySuspended) {
        updates.suspendedAt = new Date();
      } else if (!input.suspended && currentlySuspended) {
        updates.suspendedAt = null;
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.db.update(profiles).set(updates).where(eq(profiles.id, userId));
    }

    if (updates.plan !== undefined) {
      await this.audit.record({
        eventType: 'admin.user_plan_changed',
        userId,
        actor: staffId,
        subjectType: 'profile',
        subjectId: userId,
        metadata: { previousPlan: existing.plan, newPlan: updates.plan, reason: input.reason ?? null },
      });
    }

    if (updates.suspendedAt !== undefined) {
      await this.audit.record({
        eventType: updates.suspendedAt ? 'admin.user_suspended' : 'admin.user_unsuspended',
        userId,
        actor: staffId,
        subjectType: 'profile',
        subjectId: userId,
        metadata: { reason: input.reason ?? null },
      });
    }

    return this.userDetail(userId);
  }

  async resetUserQuota(staffId: string, userId: string, now = new Date()): Promise<AdminUserDetailView> {
    const [existing] = await this.db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId));
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'We could not find that user.');
    }

    const period = periodStart(now);
    await this.db
      .insert(usageCounters)
      .values({ userId, metric: 'resumes', periodStart: period, count: 0 })
      .onConflictDoUpdate({
        target: [usageCounters.userId, usageCounters.metric, usageCounters.periodStart],
        set: { count: 0, updatedAt: now },
      });

    await this.audit.record({
      eventType: 'admin.user_quota_reset',
      userId,
      actor: staffId,
      subjectType: 'usage_counter',
      subjectId: userId,
      metadata: { metric: 'resumes', periodStart: period },
    });

    return this.userDetail(userId, now);
  }

  async deleteUser(staffId: string, userId: string, correlationId: string) {
    if (staffId === userId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Use account settings to delete your own account.');
    }
    const [existing] = await this.db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId));
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'We could not find that user.');
    }

    const result = await this.privacy.requestDeletion(userId, correlationId);
    await this.audit.record({
      eventType: 'admin.user_deletion_requested',
      userId,
      actor: staffId,
      subjectType: 'deletion_request',
      subjectId: result.requestId,
      correlationId,
    });
    return result;
  }

  // ─── Operational Queues & Audit Log ────────────────────────────────────────

  async auditLog(filter: AdminAuditFilter = {}): Promise<Page<AdminAuditEventView>> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    const conditions = [sql`true`];

    if (filter.userId) {
      conditions.push(sql`ae.user_id = ${filter.userId}`);
    }
    if (filter.eventType) {
      conditions.push(sql`ae.event_type = ${filter.eventType}`);
    }
    if (filter.cursor) {
      conditions.push(sql`ae.created_at < ${filter.cursor}`);
    }

    const whereClause = sql.join(conditions, sql` and `);

    type AuditRow = {
      id: string;
      user_id: string | null;
      user_email: string | null;
      event_type: string;
      subject_type: string | null;
      subject_id: string | null;
      actor: string | null;
      ip: string | null;
      metadata_json: Record<string, unknown>;
      created_at: Date | string;
    };

    const rows = rowsOf<AuditRow>(
      await this.db.execute(sql`
        select ae.id,
               ae.user_id,
               u.email as user_email,
               ae.event_type,
               ae.subject_type,
               ae.subject_id,
               ae.actor,
               ae.ip,
               ae.metadata_json,
               ae.created_at
          from public.audit_events ae
          left join auth.users u on u.id = ae.user_id
         where ${whereClause}
         order by ae.created_at desc, ae.id desc
         limit ${limit + 1}
      `),
    );

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
        eventType: row.event_type,
        subjectType: row.subject_type,
        subjectId: row.subject_id,
        actor: row.actor,
        ip: row.ip,
        metadata: row.metadata_json ?? {},
        createdAt: toIso(row.created_at)!,
      })),
      nextCursor: hasMore && last ? toIso(last.created_at) : null,
    };
  }

  async deletionRequestsList(): Promise<AdminDeletionRequestView[]> {
    type DeletionRow = {
      id: string;
      user_id: string;
      user_email: string | null;
      status: AdminDeletionRequestView['status'];
      requested_at: Date | string;
      due_at: Date | string;
      completed_at: Date | string | null;
    };

    const rows = rowsOf<DeletionRow>(
      await this.db.execute(sql`
        select dr.id,
               dr.user_id,
               u.email as user_email,
               dr.status,
               dr.requested_at,
               dr.due_at,
               dr.completed_at
          from public.deletion_requests dr
          left join auth.users u on u.id = dr.user_id
         order by dr.requested_at desc
         limit 100
      `),
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      status: row.status,
      requestedAt: toIso(row.requested_at)!,
      dueAt: toIso(row.due_at)!,
      completedAt: toIso(row.completed_at),
    }));
  }

  async waitlistList(): Promise<AdminWaitlistEntryView[]> {
    const rows = await this.db.select().from(orgWaitlist).orderBy(desc(orgWaitlist.createdAt)).limit(100);
    return rows.map((row) => ({
      id: row.id,
      orgName: row.orgName,
      contactName: row.contactName,
      email: row.email,
      orgType: row.orgType,
      volume: row.volume,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
