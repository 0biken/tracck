import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  ApiError,
  POLICY_TEXT_VERSION,
  type GithubConnectResponse,
  type SourceProvider,
  type SourceState,
  type SourceView,
  type UploadSourceResponse,
} from '@tracck/shared';
import { SecretBox } from '../common/secret-box';
import type { ApiEnv } from '../config/env';
import { AuditService } from '../core/audit.service';
import { EntitlementsService } from '../core/entitlements.service';
import { JobDispatcher } from '../core/job-dispatcher.service';
import type { Database } from '../db';
import { sourceConnectionSecrets, sourceConnections, sourceItems } from '../db/schema';
import type { ObjectStorage } from '../storage/storage';
import { DB, ENV, GITHUB, SECRET_BOX, STORAGE } from '../tokens';
import type { GithubClient } from './github.client';

export type UploadProvider = Extract<SourceProvider, 'cv' | 'linkedin' | 'portfolio' | 'x' | 'behance'>;

export interface UploadInput {
  provider: UploadProvider;
  file?: { name: string; buffer: Buffer; contentType: string };
  text?: string;
  url?: string;
}

/** Sources of which a person has one: uploading again replaces what was there. */
const REPLACEABLE: UploadProvider[] = ['cv', 'linkedin', 'x'];

/** What each uploaded file is stored as. */
const FILE_TYPE = { cv: 'uploaded_cv', linkedin: 'linkedin_profile', x: 'social_post' } as const;

const NAMES: Record<SourceProvider, string> = {
  github: 'GitHub',
  cv: 'CV',
  linkedin: 'LinkedIn',
  portfolio: 'Portfolio',
  x: 'X',
  behance: 'Behance',
  manual: 'Manual entry',
};

interface ListRow {
  id: string;
  provider: SourceProvider;
  display_handle: string | null;
  status: string;
  last_sync_at: string | null;
  last_error_code: string | null;
  created_at: string;
  entries: number;
  job_id: string | null;
  job_status: string | null;
  progress_percent: number | null;
  safe_error_message: string | null;
}

const stateOf = (status: string): SourceState =>
  status === 'synced' || status === 'partial' ? 'ready' : status === 'needs_reauth' || status === 'error' || status === 'not_connected' ? 'problem' : 'collecting';

function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'file';

@Injectable()
export class SourcesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(SECRET_BOX) private readonly box: SecretBox,
    @Inject(GITHUB) private readonly github: GithubClient,
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
    @Inject(JobDispatcher) private readonly jobs: JobDispatcher,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ─── Reading ───────────────────────────────────────────────────────────────

  async list(userId: string): Promise<SourceView[]> {
    const result = await this.db.execute(sql`
      select sc.id, sc.provider, sc.display_handle, sc.status, sc.last_sync_at, sc.last_error_code, sc.created_at,
             (select count(distinct es.evidence_id)::int
                from public.evidence_sources es
                join public.source_items si on si.id = es.source_item_id
               where si.connection_id = sc.id) as entries,
             j.id as job_id, j.status as job_status, j.progress_percent, j.safe_error_message
        from public.source_connections sc
        left join lateral (
          select id, status, progress_percent, safe_error_message
            from public.background_jobs
           where user_id = sc.user_id and input_ref_json ->> 'connectionId' = sc.id::text
           order by created_at desc limit 1
        ) j on true
       where sc.user_id = ${userId} and sc.revoked_at is null
       order by sc.created_at`);
    return rowsOf<ListRow>(result).map((row) => this.toView(row));
  }

  async view(userId: string, connectionId: string): Promise<SourceView> {
    const found = (await this.list(userId)).find((source) => source.id === connectionId);
    if (!found) throw new ApiError(404, 'NOT_FOUND', 'We could not find that source.');
    return found;
  }

  private toView(row: ListRow): SourceView {
    const state = stateOf(row.status);
    return {
      id: row.id,
      provider: row.provider,
      name: row.provider === 'linkedin' && row.display_handle?.toLowerCase().endsWith('.zip') ? 'LinkedIn data export' : NAMES[row.provider] ?? row.provider,
      detail: row.display_handle,
      state,
      entries: row.entries,
      lastCollectedAt: row.last_sync_at ? new Date(row.last_sync_at).toISOString() : null,
      progress: state === 'collecting' && row.progress_percent !== null ? { done: row.progress_percent, total: 100 } : null,
      problem: state === 'problem' ? (row.safe_error_message ?? 'Something went wrong collecting this source.') : null,
      jobId: row.job_id,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  // ─── GitHub ────────────────────────────────────────────────────────────────

  async githubConnect(userId: string, from: 'onboarding' | 'sources'): Promise<GithubConnectResponse> {
    const existing = await this.findActive(userId, 'github');
    if (!existing) await this.entitlements.assertCanAddSource(userId);

    const state = await new SignJWT({ from })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setExpirationTime('10m')
      .sign(this.box.signingKey());
    return { authorizeUrl: this.github.authorizeUrl(state) };
  }

  /** GitHub sends the person here. Returns the frontend address to send them on to. */
  async githubCallback(code: string | undefined, state: string | undefined, correlationId: string): Promise<string> {
    let userId: string;
    let from: 'onboarding' | 'sources' = 'sources';
    try {
      const verified = await jwtVerify(state ?? '', this.box.signingKey());
      userId = verified.payload.sub!;
      if (verified.payload.from === 'onboarding') from = 'onboarding';
    } catch {
      return `${this.env.APP_ORIGIN}/dashboard/sources?error=github`;
    }
    const back = (query: string) => `${this.env.APP_ORIGIN}${from === 'onboarding' ? '/onboarding/status' : '/dashboard/sources'}?${query}`;
    if (!code) return back('error=github');

    try {
      const tokens = await this.github.exchangeCode(code);
      const account = await this.github.getUser(tokens.accessToken);

      let connection = await this.findActive(userId, 'github');
      if (!connection) {
        await this.entitlements.assertCanAddSource(userId);
        const [row] = await this.db
          .insert(sourceConnections)
          .values({
            userId,
            provider: 'github',
            providerAccountId: String(account.id),
            displayHandle: `@${account.login}`,
            status: 'sync_queued',
            consentVersion: POLICY_TEXT_VERSION,
          })
          .returning({ id: sourceConnections.id });
        connection = { id: row.id };
      } else {
        await this.db
          .update(sourceConnections)
          .set({ providerAccountId: String(account.id), displayHandle: `@${account.login}`, status: 'sync_queued', lastErrorCode: null })
          .where(eq(sourceConnections.id, connection.id));
      }

      // A reconnect replaces every token, so an old refresh token is never kept alongside a new access token.
      const secret = {
        accessTokenEncrypted: this.box.encrypt(tokens.accessToken),
        refreshTokenEncrypted: tokens.refreshToken ? this.box.encrypt(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
        keyVersion: this.box.keyVersion,
      };
      await this.db
        .insert(sourceConnectionSecrets)
        .values({ connectionId: connection.id, ...secret })
        .onConflictDoUpdate({
          target: sourceConnectionSecrets.connectionId,
          set: { ...secret, updatedAt: new Date() },
        });

      await this.jobs.dispatch({
        userId,
        jobType: 'source_import',
        idempotencyKey: `github:${connection.id}:${randomUUID()}`,
        input: { connectionId: connection.id },
        correlationId,
      });
      await this.audit.record({ userId, eventType: 'source.connected', subjectType: 'source', subjectId: connection.id, metadata: { provider: 'github' }, correlationId });
      return back('connected=github');
    } catch {
      return back('error=github');
    }
  }

  // ─── Uploads, links and pasted text ────────────────────────────────────────

  async create(userId: string, input: UploadInput, idempotencyKey: string, correlationId: string): Promise<UploadSourceResponse> {
    // The same request again returns the first answer.
    const replay = await this.jobByKey(userId, idempotencyKey);
    if (replay?.connectionId) return this.response(userId, replay.connectionId, replay.id);

    const connectionId = randomUUID();
    const existing = REPLACEABLE.includes(input.provider) ? await this.findActive(userId, input.provider) : null;
    if (!existing) await this.entitlements.assertCanAddSource(userId);

    // Store the file first: if storage is down, nothing else has changed yet.
    let objectKey: string | null = null;
    if (input.file) {
      objectKey = `users/${userId}/${connectionId}/${randomUUID()}-${safeName(input.file.name)}`;
      await this.storage.put(objectKey, input.file.buffer, input.file.contentType);
    }

    const handle = input.file?.name ?? input.url ?? (input.provider === 'linkedin' ? 'Pasted profile' : 'Pasted text');

    if (existing) {
      // Replace: what the old file produced goes, and the new one takes its place.
      await this.purge(userId, existing.id, true);
      await this.db
        .update(sourceConnections)
        .set({ displayHandle: handle, status: 'sync_queued', lastErrorCode: null })
        .where(eq(sourceConnections.id, existing.id));
    } else {
      await this.db.insert(sourceConnections).values({
        id: connectionId,
        userId,
        provider: input.provider,
        displayHandle: handle,
        status: 'sync_queued',
        consentVersion: POLICY_TEXT_VERSION,
      });
    }
    const id = existing?.id ?? connectionId;

    if (input.file && objectKey) {
      await this.db.insert(sourceItems).values({
        userId,
        connectionId: id,
        sourceType: FILE_TYPE[input.provider as keyof typeof FILE_TYPE],
        title: input.file.name,
        rawObjectKey: objectKey,
        contentHash: createHash('sha256').update(input.file.buffer).digest('hex'),
      });
    } else if (input.text) {
      await this.db.insert(sourceItems).values({
        userId,
        connectionId: id,
        sourceType: input.provider === 'linkedin' ? 'linkedin_profile' : 'pasted_text',
        title: handle,
        bodyText: input.text,
        contentHash: createHash('sha256').update(input.text).digest('hex'),
      });
    }

    const { job } = await this.jobs.dispatch({
      userId,
      jobType: input.file ? 'cv_parse' : 'source_import',
      idempotencyKey,
      input: { connectionId: id },
      correlationId,
    });
    await this.audit.record({ userId, eventType: 'source.added', subjectType: 'source', subjectId: id, metadata: { provider: input.provider }, correlationId });
    return this.response(userId, id, job.id);
  }

  /** Refresh and retry both read the source again. */
  async restart(userId: string, connectionId: string, idempotencyKey: string, correlationId: string): Promise<UploadSourceResponse> {
    const connection = await this.owned(userId, connectionId);
    const [file] = await this.db
      .select({ id: sourceItems.id })
      .from(sourceItems)
      .where(and(eq(sourceItems.connectionId, connection.id), sql`${sourceItems.rawObjectKey} is not null`))
      .limit(1);

    await this.db
      .update(sourceConnections)
      .set({ status: 'sync_queued', lastErrorCode: null })
      .where(eq(sourceConnections.id, connection.id));

    const { job } = await this.jobs.dispatch({
      userId,
      jobType: file ? 'cv_parse' : 'source_import',
      idempotencyKey,
      input: { connectionId: connection.id },
      correlationId,
    });
    return this.response(userId, connection.id, job.id);
  }

  // ─── Removing ──────────────────────────────────────────────────────────────

  async remove(userId: string, connectionId: string, entries: 'keep' | 'delete', correlationId: string): Promise<void> {
    const connection = await this.owned(userId, connectionId);
    await this.purge(userId, connection.id, entries === 'delete');
    await this.db.delete(sourceConnectionSecrets).where(eq(sourceConnectionSecrets.connectionId, connection.id));
    await this.db
      .update(sourceConnections)
      .set({ revokedAt: new Date(), status: 'not_connected' })
      .where(eq(sourceConnections.id, connection.id));
    await this.audit.record({
      userId,
      eventType: 'source.removed',
      subjectType: 'source',
      subjectId: connection.id,
      metadata: { entries },
      correlationId,
    });
  }

  /**
   * Removes the stored files of a source and, when asked, the entries it produced.
   * An entry that another source also supports is kept: only the link goes.
   */
  private async purge(userId: string, connectionId: string, deleteEntries: boolean): Promise<void> {
    const items = await this.db
      .select({ id: sourceItems.id, key: sourceItems.rawObjectKey })
      .from(sourceItems)
      .where(eq(sourceItems.connectionId, connectionId));

    const keys = items.map((item) => item.key).filter((key): key is string => key !== null);
    if (keys.length > 0) await this.storage.remove(keys).catch(() => {});

    if (deleteEntries) {
      await this.db.execute(sql`
        delete from public.candidate_evidence e
         where e.user_id = ${userId}
           and exists (select 1 from public.evidence_sources es
                         join public.source_items si on si.id = es.source_item_id
                        where es.evidence_id = e.id and si.connection_id = ${connectionId})
           and not exists (select 1 from public.evidence_sources es
                             join public.source_items si on si.id = es.source_item_id
                            where es.evidence_id = e.id and si.connection_id is distinct from ${connectionId})
           and not e.pinned and not e.user_edited`);
      await this.db.delete(sourceItems).where(eq(sourceItems.connectionId, connectionId));
    } else if (keys.length > 0) {
      await this.db.update(sourceItems).set({ rawObjectKey: null }).where(eq(sourceItems.connectionId, connectionId));
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async findActive(userId: string, provider: SourceProvider): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: sourceConnections.id })
      .from(sourceConnections)
      .where(and(eq(sourceConnections.userId, userId), eq(sourceConnections.provider, provider), isNull(sourceConnections.revokedAt)))
      .limit(1);
    return row ?? null;
  }

  private async owned(userId: string, connectionId: string): Promise<{ id: string; provider: string }> {
    const [row] = await this.db
      .select({ id: sourceConnections.id, provider: sourceConnections.provider })
      .from(sourceConnections)
      .where(and(eq(sourceConnections.id, connectionId), eq(sourceConnections.userId, userId), isNull(sourceConnections.revokedAt)));
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'We could not find that source.');
    return row;
  }

  private async jobByKey(userId: string, key: string): Promise<{ id: string; connectionId: string | null } | null> {
    const result = await this.db.execute(sql`
      select id, input_ref_json ->> 'connectionId' as connection_id
        from public.background_jobs where user_id = ${userId} and idempotency_key = ${key}`);
    const [row] = rowsOf<{ id: string; connection_id: string | null }>(result);
    return row ? { id: row.id, connectionId: row.connection_id } : null;
  }

  private async response(userId: string, connectionId: string, jobId: string): Promise<UploadSourceResponse> {
    return { source: await this.view(userId, connectionId), jobId, ...this.jobs.statusUrls(jobId) };
  }
}
