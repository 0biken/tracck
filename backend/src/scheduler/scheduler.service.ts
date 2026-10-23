import { Inject, Injectable, Logger, type BeforeApplicationShutdown, type OnApplicationBootstrap } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { BillingService } from '../billing/billing.service';
import type { ApiEnv } from '../config/env';
import { JobDispatcher } from '../core/job-dispatcher.service';
import type { Database } from '../db';
import type { ObjectStorage } from '../storage/storage';
import { DB, ENV, STORAGE } from '../tokens';

const TICK_MS = 5 * 60_000;
/** Sources are refreshed after this hour (UTC) each day, and the digest goes out after this hour on Mondays. */
const SYNC_HOUR = 6;
const DIGEST_HOUR = 7;
const CLEANUP_HOUR = 3;
const BATCH = 200;
const DAY_MS = 86_400_000;
const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;
const dayOf = (now: Date) => now.toISOString().slice(0, 10);
const ago = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();

/** The ISO week, so a digest is made once a week however many times the clock ticks. */
function weekOf(now: Date) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-W${Math.ceil(((date.getTime() - first.getTime()) / DAY_MS + 1) / 7)}`;
}

/**
 * The jobs that run on a clock: refresh sources every day, send the weekly digest, and
 * tidy up. Each tick is safe to repeat and safe to run on several instances at once,
 * because every job it makes has a key that names the day or week it belongs to.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger('Scheduler');
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(JobDispatcher) private readonly jobs: JobDispatcher,
    @Inject(BillingService) private readonly billing: BillingService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  onApplicationBootstrap() {
    if (this.env.RUN_JOB_WORKER !== 'true') return;
    this.timer = setInterval(
      () => void this.tick().catch((error) => this.logger.error(`tick failed: ${error instanceof Error ? error.name : 'unknown'}`)),
      TICK_MS,
    );
    this.timer.unref();
  }

  beforeApplicationShutdown() {
    clearInterval(this.timer);
  }

  async tick(now = new Date()) {
    return {
      synced: await this.refreshSources(now),
      digests: await this.sendDigests(now),
      cleanup: await this.cleanup(now),
    };
  }

  /** Reads GitHub and portfolio sources again, once a day, for sources not read since this morning. */
  async refreshSources(now: Date): Promise<number> {
    if (now.getUTCHours() < SYNC_HOUR) return 0;
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), SYNC_HOUR));
    const due = rowsOf<{ id: string; user_id: string }>(
      await this.db.execute(sql`
        select c.id, c.user_id from public.source_connections c
          join public.profiles p on p.id = c.user_id
         where c.revoked_at is null and p.deleted_at is null
           and c.provider in ('github', 'portfolio') and c.status in ('synced', 'partial')
           and (c.last_sync_at is null or c.last_sync_at < ${since.toISOString()})
         order by c.last_sync_at nulls first limit ${BATCH}`),
    );
    for (const connection of due) {
      await this.jobs.dispatch({
        userId: connection.user_id,
        jobType: 'source_sync',
        idempotencyKey: `sync:${connection.id}:${dayOf(now)}`,
        input: { connectionId: connection.id },
      });
      await this.db.execute(sql`update public.source_connections set status = 'sync_queued' where id = ${connection.id} and status in ('synced', 'partial')`);
    }
    return due.length;
  }

  /** On Mondays, to people with something new and who have not turned the digest off. */
  async sendDigests(now: Date): Promise<number> {
    if (now.getUTCDay() !== 1 || now.getUTCHours() < DIGEST_HOUR) return 0;
    const people = rowsOf<{ user_id: string; n: number }>(
      await this.db.execute(sql`
        select e.user_id, count(*)::int as n
          from public.candidate_evidence e join public.profiles p on p.id = e.user_id
         where e.created_at > ${ago(now, 7)} and not e.excluded and p.deleted_at is null
           and coalesce(p.preferences_json -> 'notifications' ->> 'weekly', 'true') <> 'false'
         group by e.user_id order by e.user_id limit ${BATCH * 2}`),
    );
    for (const person of people) {
      await this.jobs.dispatch({
        userId: person.user_id,
        jobType: 'weekly_digest',
        idempotencyKey: `digest:${person.user_id}:${weekOf(now)}`,
        input: { entries: person.n },
      });
    }
    return people.length;
  }

  /** Once a day, on one instance: expire lapsed plans, apply CV retention, and drop what is no longer needed. */
  async cleanup(now: Date): Promise<Record<string, number> | null> {
    if (now.getUTCHours() < CLEANUP_HOUR) return null;
    const day = dayOf(now);

    const claimed = await this.db.transaction(async (tx) => {
      const [lock] = rowsOf<{ ok: boolean }>(await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext('tracck.cleanup')) as ok`));
      if (!lock?.ok) return false;
      const [mark] = rowsOf<{ id: string }>(
        await tx.execute(sql`
          insert into public.audit_events (event_type, actor, metadata_json)
          select 'system.cleanup', 'scheduler', ${JSON.stringify({ day })}::jsonb
           where not exists (select 1 from public.audit_events where event_type = 'system.cleanup' and metadata_json ->> 'day' = ${day})
          returning id`),
      );
      return Boolean(mark);
    });
    if (!claimed) return null;

    const count = async (query: ReturnType<typeof sql>) => rowsOf<unknown>(await this.db.execute(query)).length;
    return {
      plans: await this.billing.expireLapsed(now),
      cvFiles: await this.applyCvRetention(now),
      consentRequests: await count(sql`update public.consent_requests set status = 'expired' where status = 'pending' and expires_at < ${now.toISOString()} returning id`),
      studentLinks: await count(sql`delete from public.student_verifications where expires_at < ${ago(now, 7)} returning id`),
      modelCalls: await count(sql`delete from public.llm_calls where created_at < ${ago(now, 90)} returning id`),
      webhookEvents: await count(sql`delete from public.webhook_events where received_at < ${ago(now, 90)} returning id`),
      exports: await this.dropOldExports(now),
    };
  }

  /** The CV file and its text go when the person's retention setting says so. The entries made from it stay. */
  private async applyCvRetention(now: Date): Promise<number> {
    const months = (n: number) => new Date(now.getTime() - n * 30.44 * DAY_MS).toISOString();
    const expired = rowsOf<{ id: string; key: string | null }>(
      await this.db.execute(sql`
        select i.id, i.raw_object_key as key
          from public.source_items i
          join public.source_connections c on c.id = i.connection_id
          join public.profiles p on p.id = i.user_id
         where c.provider = 'cv' and i.deletion_status = 'active' and (i.raw_object_key is not null or i.body_text is not null)
           and case coalesce(p.preferences_json ->> 'cvRetention', '12_months')
                 when '6_months' then i.imported_at < ${months(6)}
                 when 'until_deleted' then false
                 else i.imported_at < ${months(12)}
               end
         limit ${BATCH}`),
    );
    const keys = expired.map((row) => row.key).filter((key): key is string => Boolean(key));
    await this.storage.remove(keys).catch(() => {});
    for (const row of expired) {
      await this.db.execute(sql`update public.source_items set raw_object_key = null, body_text = null where id = ${row.id}`);
    }
    return expired.length;
  }

  private async dropOldExports(now: Date): Promise<number> {
    const old = rowsOf<{ id: string; key: string }>(
      await this.db.execute(sql`
        select id, result_ref_json ->> 'key' as key from public.background_jobs
         where job_type = 'data_export' and status = 'succeeded' and result_ref_json ->> 'key' is not null
           and completed_at < ${ago(now, 7)}`),
    );
    await this.storage.remove(old.map((row) => row.key)).catch(() => {});
    for (const row of old) await this.db.execute(sql`update public.background_jobs set result_ref_json = '{}'::jsonb where id = ${row.id}`);
    return old.length;
  }
}
