// Durable job state in PostgreSQL (§5.8, §7.2, §7.3).
//
// Every state change is one conditional UPDATE that names the statuses it may
// leave. If another process got there first the UPDATE matches no row and the
// method returns null, so duplicate deliveries and races cannot corrupt a job.
// Updates made by a worker also name the attempt it claimed, so a worker that
// was presumed lost and replaced cannot overwrite the newer attempt's state.

import type { JobRecord, JobStatus, JobStep, JobType } from './jobs';
import { RUNNABLE_STATUSES, WAITING_STATUSES } from './jobs';

/** The slice of `pg.Pool` this module needs. PGlite satisfies it too. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface CreateJobInput {
  userId: string;
  jobType: JobType;
  idempotencyKey: string;
  inputRef?: Record<string, unknown>;
  maxAttempts?: number;
  correlationId?: string;
}

interface JobRow {
  id: string;
  user_id: string;
  job_type: JobType;
  status: JobStatus;
  step: JobStep | null;
  progress_percent: number | null;
  attempt_count: number;
  max_attempts: number;
  idempotency_key: string;
  input_ref_json: Record<string, unknown>;
  result_ref_json: Record<string, unknown> | null;
  error_code: string | null;
  safe_error_message: string | null;
  correlation_id: string | null;
  enqueue_error: string | null;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: Date | string | null;
  heartbeat_at: Date | string | null;
  completed_at: Date | string | null;
  cancel_requested_at: Date | string | null;
}

function iso(value: Date | string): string;
function iso(value: Date | string | null): string | null;
function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function toRecord(row: JobRow): JobRecord {
  return {
    id: row.id,
    userId: row.user_id,
    jobType: row.job_type,
    status: row.status,
    step: row.step,
    progressPercent: row.progress_percent,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    idempotencyKey: row.idempotency_key,
    inputRef: row.input_ref_json,
    resultRef: row.result_ref_json,
    errorCode: row.error_code,
    safeErrorMessage: row.safe_error_message,
    correlationId: row.correlation_id,
    enqueueError: row.enqueue_error,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    startedAt: iso(row.started_at),
    heartbeatAt: iso(row.heartbeat_at),
    completedAt: iso(row.completed_at),
    cancelRequestedAt: iso(row.cancel_requested_at),
  };
}

const TOUCH = 'version = version + 1, updated_at = now()';

export class JobStore {
  constructor(private readonly db: Queryable) {}

  private async one(text: string, params: unknown[]): Promise<JobRecord | null> {
    const { rows } = await this.db.query(text, params);
    return rows.length ? toRecord(rows[0] as JobRow) : null;
  }

  private async many(text: string, params: unknown[]): Promise<JobRecord[]> {
    const { rows } = await this.db.query(text, params);
    return (rows as JobRow[]).map(toRecord);
  }

  /**
   * Inserts a queued job. A repeat of the same user and idempotency key returns
   * the job created the first time, with `created: false`.
   */
  async create(input: CreateJobInput): Promise<{ job: JobRecord; created: boolean }> {
    const inserted = await this.one(
      `insert into background_jobs
         (user_id, job_type, idempotency_key, input_ref_json, max_attempts, correlation_id)
       values ($1, $2, $3, $4::jsonb, $5, $6)
       on conflict (user_id, idempotency_key) do nothing
       returning *`,
      [
        input.userId,
        input.jobType,
        input.idempotencyKey,
        JSON.stringify(input.inputRef ?? {}),
        input.maxAttempts ?? 3,
        input.correlationId ?? null,
      ],
    );
    if (inserted) return { job: inserted, created: true };

    const existing = await this.one(
      `select * from background_jobs where user_id = $1 and idempotency_key = $2`,
      [input.userId, input.idempotencyKey],
    );
    if (!existing) throw new Error('Job vanished between insert and select');
    return { job: existing, created: false };
  }

  get(id: string): Promise<JobRecord | null> {
    return this.one(`select * from background_jobs where id = $1`, [id]);
  }

  /** Returns null both when the job does not exist and when it belongs to someone else. */
  getForUser(id: string, userId: string): Promise<JobRecord | null> {
    return this.one(`select * from background_jobs where id = $1 and user_id = $2`, [id, userId]);
  }

  /** Claims a job for a worker. Null means it is not runnable, so the delivery should be dropped. */
  markRunning(id: string): Promise<JobRecord | null> {
    return this.one(
      `update background_jobs
          set status = 'running', attempt_count = attempt_count + 1,
              started_at = coalesce(started_at, now()), heartbeat_at = now(),
              error_code = null, safe_error_message = null, enqueue_error = null, ${TOUCH}
        where id = $1 and status = any($2::text[]) and cancel_requested_at is null
        returning *`,
      [id, RUNNABLE_STATUSES],
    );
  }

  setStep(id: string, attempt: number, step: JobStep, progressPercent: number | null): Promise<JobRecord | null> {
    return this.one(
      `update background_jobs
          set step = $3, progress_percent = $4, heartbeat_at = now(), ${TOUCH}
        where id = $1 and attempt_count = $2 and status = 'running'
        returning *`,
      [id, attempt, step, progressPercent],
    );
  }

  /** Does not bump `version`: a heartbeat is not something a user needs to see. */
  async heartbeat(id: string, attempt: number): Promise<void> {
    await this.db.query(
      `update background_jobs set heartbeat_at = now()
        where id = $1 and attempt_count = $2 and status = 'running'`,
      [id, attempt],
    );
  }

  succeed(id: string, attempt: number, resultRef: Record<string, unknown>): Promise<JobRecord | null> {
    return this.one(
      `update background_jobs
          set status = 'succeeded', progress_percent = 100, result_ref_json = $3::jsonb,
              completed_at = now(), ${TOUCH}
        where id = $1 and attempt_count = $2 and status = 'running'
        returning *`,
      [id, attempt, JSON.stringify(resultRef)],
    );
  }

  private leaveRunning(
    id: string,
    attempt: number,
    status: 'failed' | 'retry_wait' | 'needs_user_action',
    code: string,
    safeMessage: string,
  ): Promise<JobRecord | null> {
    return this.one(
      `update background_jobs
          set status = $3, error_code = $4, safe_error_message = $5,
              completed_at = case when $3 = 'failed' then now() else null end, ${TOUCH}
        where id = $1 and attempt_count = $2 and status = 'running'
        returning *`,
      [id, attempt, status, code, safeMessage],
    );
  }

  fail(id: string, attempt: number, code: string, safeMessage: string) {
    return this.leaveRunning(id, attempt, 'failed', code, safeMessage);
  }

  scheduleRetry(id: string, attempt: number, code: string, safeMessage: string) {
    return this.leaveRunning(id, attempt, 'retry_wait', code, safeMessage);
  }

  needsUserAction(id: string, attempt: number, code: string, safeMessage: string) {
    return this.leaveRunning(id, attempt, 'needs_user_action', code, safeMessage);
  }

  /** Called by a worker that saw the cancel request between steps. */
  cancelRunning(id: string, attempt: number): Promise<JobRecord | null> {
    return this.one(
      `update background_jobs
          set status = 'cancelled', completed_at = now(), ${TOUCH}
        where id = $1 and attempt_count = $2 and status = 'running'
        returning *`,
      [id, attempt],
    );
  }

  /**
   * Records the user's cancel request. A job that is waiting is cancelled at
   * once; a running job keeps going until its worker checks between steps.
   * Null means the job is not the user's or has already settled.
   */
  requestCancel(id: string, userId: string): Promise<JobRecord | null> {
    return this.one(
      `update background_jobs
          set cancel_requested_at = coalesce(cancel_requested_at, now()),
              status = case when status = any($3::text[]) then 'cancelled' else status end,
              completed_at = case when status = any($3::text[]) then now() else completed_at end,
              ${TOUCH}
        where id = $1 and user_id = $2 and status = any($4::text[])
        returning *`,
      [id, userId, WAITING_STATUSES, [...WAITING_STATUSES, 'running']],
    );
  }

  /** The retry action: a failed job goes back to the queue with a fresh attempt budget. */
  requeueFailed(id: string, userId: string): Promise<JobRecord | null> {
    return this.one(
      `update background_jobs
          set status = 'queued', attempt_count = 0, step = null, progress_percent = null,
              error_code = null, safe_error_message = null, completed_at = null,
              cancel_requested_at = null, ${TOUCH}
        where id = $1 and user_id = $2 and status = 'failed'
        returning *`,
      [id, userId],
    );
  }

  async recordEnqueueError(id: string, message: string): Promise<void> {
    await this.db.query(`update background_jobs set enqueue_error = $2 where id = $1`, [id, message]);
  }

  /** Jobs waiting longer than expected. The reconciler checks whether Redis still holds them. */
  findStaleWaiting(olderThanSeconds: number, limit: number): Promise<JobRecord[]> {
    return this.many(
      `select * from background_jobs
        where status = any($1::text[])
          and updated_at < now() - make_interval(secs => $2)
        order by updated_at
        limit $3`,
      [RUNNABLE_STATUSES, olderThanSeconds, limit],
    );
  }

  /**
   * Takes a running job away from a worker that stopped sending heartbeats. It
   * goes back to `retry_wait` if attempts remain and to `failed` otherwise.
   * Null means a heartbeat arrived in the meantime.
   */
  recoverStaleRunning(id: string, heartbeatOlderThanSeconds: number): Promise<JobRecord | null> {
    return this.one(
      `update background_jobs
          set status = case when attempt_count < max_attempts then 'retry_wait' else 'failed' end,
              error_code = 'WORKER_LOST',
              safe_error_message = 'This job stopped unexpectedly.',
              completed_at = case when attempt_count < max_attempts then null else now() end,
              ${TOUCH}
        where id = $1 and status = 'running'
          and coalesce(heartbeat_at, started_at, updated_at) < now() - make_interval(secs => $2)
        returning *`,
      [id, heartbeatOlderThanSeconds],
    );
  }

  /** Running jobs whose worker stopped sending heartbeats. */
  findStaleRunning(heartbeatOlderThanSeconds: number, limit: number): Promise<JobRecord[]> {
    return this.many(
      `select * from background_jobs
        where status = 'running'
          and coalesce(heartbeat_at, started_at, updated_at) < now() - make_interval(secs => $1)
        order by heartbeat_at nulls first
        limit $2`,
      [heartbeatOlderThanSeconds, limit],
    );
  }
}
