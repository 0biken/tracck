import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  ApiError,
  POLICY_PURPOSES,
  POLICY_TEXT_VERSION,
  ROLE_IDS,
  type MeView,
  type NotificationView,
  type Page,
  type PlanId,
  type Preferences,
  type RoleId,
  type SourceProvider,
  type SummaryView,
  type UpdateMeRequest,
} from '@tracck/shared';
import { EntitlementsService, periodResetsOn } from '../core/entitlements.service';
import type { Database } from '../db';
import {
  apiClients,
  notifications,
  profiles,
  userPolicyConsents,
} from '../db/schema';
import { DB } from '../tokens';

export const DEFAULT_PREFERENCES: Preferences = {
  notifications: { done: true, weekly: true, attention: true },
  cvRetention: '12_months',
};

const isRole = (value: string): value is RoleId => (ROLE_IDS as readonly string[]).includes(value);

/** Rows from a raw query, whichever driver ran it. */
function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

@Injectable()
export class MeService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
  ) {}

  async view(userId: string, email: string | null): Promise<MeView> {
    const [profile] = await this.db.select().from(profiles).where(eq(profiles.id, userId));
    if (!profile) throw new ApiError(404, 'NOT_FOUND', 'We could not find your account.');

    const accepted = await this.db
      .select({ purpose: userPolicyConsents.purpose })
      .from(userPolicyConsents)
      .where(and(eq(userPolicyConsents.userId, userId), eq(userPolicyConsents.textVersion, POLICY_TEXT_VERSION)));

    const stored = profile.preferencesJson as Partial<Preferences>;
    const roles = profile.preferredRoles.filter(isRole);

    return {
      id: profile.id,
      email,
      name: profile.displayName,
      headline: profile.headline,
      location: profile.location,
      phone: profile.phone,
      address: profile.address,
      dateOfBirth: profile.dateOfBirth,
      nationality: profile.nationality,
      roles,
      primaryRole: isRole(profile.primaryRole ?? '') ? (profile.primaryRole as RoleId) : (roles[0] ?? null),
      plan: profile.plan as PlanId,
      onboardingCompleted: profile.onboardingCompletedAt !== null,
      policyAccepted: POLICY_PURPOSES.every((purpose) => accepted.some((row) => row.purpose === purpose)),
      preferences: {
        notifications: { ...DEFAULT_PREFERENCES.notifications, ...stored.notifications },
        cvRetention: stored.cvRetention ?? DEFAULT_PREFERENCES.cvRetention,
      },
    };
  }

  async update(
    userId: string,
    email: string | null,
    input: UpdateMeRequest,
  ) {
    const changes: Partial<typeof profiles.$inferInsert> = {};
    if (input.name !== undefined) changes.displayName = input.name;
    if (input.headline !== undefined) changes.headline = input.headline;
    if (input.location !== undefined) changes.location = input.location;
    if (input.phone !== undefined) changes.phone = input.phone;
    if (input.address !== undefined) changes.address = input.address;
    if (input.dateOfBirth !== undefined) changes.dateOfBirth = input.dateOfBirth;
    if (input.nationality !== undefined) changes.nationality = input.nationality;
    if (input.roles) {
      changes.preferredRoles = input.roles;
      changes.primaryRole = input.roles[0];
    }
    if (Object.keys(changes).length > 0) {
      await this.db.update(profiles).set(changes).where(eq(profiles.id, userId));
    }
    return this.view(userId, email);
  }

  async setPreferences(userId: string, preferences: Preferences): Promise<Preferences> {
    await this.db
      .update(profiles)
      .set({
        preferencesJson: sql`${profiles.preferencesJson} || ${JSON.stringify(preferences)}::jsonb`,
      })
      .where(eq(profiles.id, userId));
    return preferences;
  }

  /** Records agreement to the current Terms, Privacy Policy and AI processing, which finishes onboarding. */
  async acceptPolicy(userId: string): Promise<void> {
    await this.db
      .insert(userPolicyConsents)
      .values(POLICY_PURPOSES.map((purpose) => ({ userId, purpose, textVersion: POLICY_TEXT_VERSION })))
      .onConflictDoNothing();
    await this.db
      .update(profiles)
      .set({ onboardingCompletedAt: sql`coalesce(${profiles.onboardingCompletedAt}, now())` })
      .where(eq(profiles.id, userId));
  }

  // ─── Home counts ───────────────────────────────────────────────────────────

  async summary(userId: string, now = new Date()): Promise<SummaryView> {
    const q = <T,>(query: ReturnType<typeof sql>) => this.db.execute(query).then((result) => rowsOf<T>(result));
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const [evidence, bySource, sources, resumes, graph, review, duplicates, used, { entitlements }] = await Promise.all([
      q<{ entries: number; pinned: number; excluded: number; edited: number; since: number }>(sql`
        select count(*)::int as entries,
               count(*) filter (where pinned)::int as pinned,
               count(*) filter (where excluded)::int as excluded,
               count(*) filter (where user_edited)::int as edited,
               count(*) filter (where created_at >= ${weekAgo.toISOString()})::int as since
          from public.candidate_evidence where user_id = ${userId}`),
      q<{ provider: string | null; n: number }>(sql`
        select source_provider as provider, count(*)::int as n
          from public.candidate_evidence where user_id = ${userId} group by 1`),
      q<{ total: number; ready: number; last_sync: string | null }>(sql`
        select count(*)::int as total,
               count(*) filter (where status in ('synced', 'partial'))::int as ready,
               max(last_sync_at) as last_sync
          from public.source_connections where user_id = ${userId} and revoked_at is null`),
      q<{ total: number; exported: number; last_exported: string | null }>(sql`
        select count(*) filter (where status <> 'archived')::int as total,
               count(*) filter (where last_exported_at is not null)::int as exported,
               max(last_exported_at) as last_exported
          from public.resume_documents where user_id = ${userId}`),
      q<{ projects: number; skills: number }>(sql`
        select count(distinct project_key)::int as projects,
               (select count(distinct s)::int from public.candidate_evidence e2, unnest(e2.skills) s
                 where e2.user_id = ${userId}) as skills
          from public.candidate_evidence where user_id = ${userId} and project_key is not null`),
      q<{ weaknesses: number }>(sql`
        select jsonb_array_length(result_json -> 'issues')::int as weaknesses
          from public.cv_reviews where user_id = ${userId} order by created_at desc limit 1`),
      q<{ n: number }>(sql`
        select count(*)::int as n from public.evidence_relations
         where user_id = ${userId} and relation_type = 'possible_duplicate'`),
      this.entitlements.resumesUsed(userId, now),
      this.entitlements.entitlementsOf(userId),
    ]);

    const counts = Object.fromEntries(
      (['github', 'cv', 'linkedin', 'portfolio', 'x', 'behance', 'manual'] as SourceProvider[]).map((p) => [p, 0]),
    ) as Record<SourceProvider, number>;
    for (const row of bySource) if (row.provider && row.provider in counts) counts[row.provider as SourceProvider] = row.n;

    const e = evidence[0];
    const s = sources[0];
    const r = resumes[0];
    const g = graph[0];

    return {
      entries: e?.entries ?? 0,
      entriesSince: e && e.since > 0 ? { date: weekAgo.toISOString().slice(0, 10), count: e.since } : null,
      sourcesTotal: s?.total ?? 0,
      sourcesReady: s?.ready ?? 0,
      resumes: r?.total ?? 0,
      exported: r?.exported ?? 0,
      lastExportedAt: r?.last_exported ? new Date(r.last_exported).toISOString() : null,
      resumesThisMonth: used,
      resumesLimit: entitlements.resumesPerMonth,
      periodResetsOn: periodResetsOn(now),
      projects: g?.projects ?? 0,
      skills: g?.skills ?? 0,
      cvWeaknesses: review[0]?.weaknesses ?? null,
      pinned: e?.pinned ?? 0,
      excluded: e?.excluded ?? 0,
      possibleDuplicates: duplicates[0]?.n ?? 0,
      edited: e?.edited ?? 0,
      bySource: counts,
      lastCollectedAt: s?.last_sync ? new Date(s.last_sync).toISOString() : null,
      nextRefreshAt: nextDailyRun(now).toISOString(),
    };
  }

  // ─── Notifications ─────────────────────────────────────────────────────────

  async notifications(userId: string): Promise<Page<NotificationView>> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.channel, 'in_app')))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return {
      items: rows.map((row) => ({
        id: row.id,
        template: row.template,
        payload: row.payloadJson as Record<string, unknown>,
        createdAt: row.createdAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
      })),
      nextCursor: null,
    };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const updated = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });
    if (updated.length === 0) throw new ApiError(404, 'NOT_FOUND', 'We could not find that notification.');
  }
}

/** The next 06:00 UTC, when the daily refresh runs. */
export function nextDailyRun(now: Date): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

