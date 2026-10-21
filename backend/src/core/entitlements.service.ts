import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, isNull, sql, type AnyColumn } from 'drizzle-orm';
import { ApiError, entitlementsFor, type Entitlements, type PlanId } from '@tracck/shared';
import type { Database } from '../db';
import { profiles, sourceConnections, usageCounters } from '../db/schema';
import { DB } from '../tokens';

const RESUMES_METRIC = 'resumes';

/** First day of the month in UTC, as the date the usage counter is keyed on. */
export function periodStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** The day the monthly allowance resets. */
export function periodResetsOn(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

/**
 * One place that answers "what may this person do?", from their plan and what
 * they have used this month. Limits are checked before work starts, never after.
 */
@Injectable()
export class EntitlementsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async planOf(userId: string): Promise<PlanId> {
    const [row] = await this.db.select({ plan: profiles.plan }).from(profiles).where(eq(profiles.id, userId));
    return row?.plan ?? 'free';
  }

  async entitlementsOf(userId: string): Promise<{ plan: PlanId; entitlements: Entitlements }> {
    const plan = await this.planOf(userId);
    return { plan, entitlements: entitlementsFor(plan) };
  }

  async resumesUsed(userId: string, now = new Date()): Promise<number> {
    const [row] = await this.db
      .select({ count: usageCounters.count })
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.userId, userId),
          eq(usageCounters.metric, RESUMES_METRIC),
          eq(usageCounters.periodStart, periodStart(now)),
        ),
      );
    return row?.count ?? 0;
  }

  async activeSources(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(sourceConnections)
      .where(and(eq(sourceConnections.userId, userId), isNull(sourceConnections.revokedAt)));
    return Number(row?.n ?? 0);
  }

  async assertCanAddSource(userId: string): Promise<void> {
    const { entitlements } = await this.entitlementsOf(userId);
    if (entitlements.maxSources === null) return;
    if ((await this.activeSources(userId)) >= entitlements.maxSources) {
      throw new ApiError(
        402,
        'PLAN_LIMIT_REACHED',
        `The Free plan includes ${entitlements.maxSources} source. Remove one or upgrade to add more.`,
      );
    }
  }

  async assertCanGenerate(userId: string, length: 'one_page' | 'full', now = new Date()): Promise<void> {
    const { entitlements } = await this.entitlementsOf(userId);
    if (length === 'full' && !entitlements.fullLength) {
      throw new ApiError(402, 'PLAN_LIMIT_REACHED', 'Full length is on Pro. Your plan exports one page only.');
    }
    if (entitlements.resumesPerMonth === null) return;
    if ((await this.resumesUsed(userId, now)) >= entitlements.resumesPerMonth) {
      throw new ApiError(
        402,
        'PLAN_LIMIT_REACHED',
        `You have used all ${entitlements.resumesPerMonth} resumes for this month. They reset on ${periodResetsOn(now)}.`,
      );
    }
  }

  async assertCanExport(userId: string, format: 'pdf' | 'docx'): Promise<void> {
    if (format === 'pdf') return;
    const { entitlements } = await this.entitlementsOf(userId);
    if (!entitlements.docxExport) {
      throw new ApiError(402, 'PLAN_LIMIT_REACHED', 'Word export is on Pro. PDF export is included on every plan.');
    }
  }

  /** Counts one resume against this month. Call when a generation starts; a failed run gives it back. */
  async recordResume(userId: string, now = new Date()): Promise<void> {
    await this.adjustResumes(userId, 1, now);
  }

  async refundResume(userId: string, now = new Date()): Promise<void> {
    await this.adjustResumes(userId, -1, now);
  }

  private async adjustResumes(userId: string, delta: 1 | -1, now: Date) {
    await this.db
      .insert(usageCounters)
      .values({ userId, metric: RESUMES_METRIC, periodStart: periodStart(now), count: Math.max(delta, 0) })
      .onConflictDoUpdate({
        target: [usageCounters.userId, usageCounters.metric, usageCounters.periodStart],
        set: { count: sqlGreatest(usageCounters.count, delta), updatedAt: new Date() },
      });
  }
}

// count + delta, never below zero.
function sqlGreatest(column: AnyColumn, delta: number) {
  return sql`greatest(${column} + ${delta}, 0)`;
}
