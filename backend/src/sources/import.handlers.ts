import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { JobError, type SourceProvider } from '@tracck/shared';
import type { SourceDocument } from '../ai/ai-engine';
import { findSkills } from '../ai/lexicon';
import { SecretBox } from '../common/secret-box';
import type { SafeFetch } from '../common/safe-fetch';
import { UnsafeUrlError } from '../common/safe-fetch';
import { NotificationsService } from '../core/notifications.service';
import type { Database } from '../db';
import { sourceConnectionSecrets, sourceConnections, sourceItems } from '../db/schema';
import { EvidenceIngestService, type IngestItem } from '../evidence/evidence-ingest.service';
import type { JobContext, JobHandler } from '../jobs/runner';
import type { ObjectStorage } from '../storage/storage';
import { DB, GITHUB, SAFE_FETCH, SECRET_BOX, STORAGE } from '../tokens';
import type { GithubClient } from './github.client';
import {
  UnreadableFileError,
  detectFileKind,
  extractDocxText,
  extractPdfText,
  htmlToText,
  parseLinkedinExport,
} from './parsers';

interface Connection {
  id: string;
  userId: string;
  provider: SourceProvider;
  displayHandle: string | null;
}

type RawRows = { rows: Record<string, unknown>[] };

/** Shared by the two import handlers: loading the connection, saving items, and reporting the outcome. */
abstract class ImportHandler {
  protected constructor(
    protected readonly db: Database,
    protected readonly ingest: EvidenceIngestService,
    protected readonly notifications: NotificationsService,
  ) {}

  protected async load(ctx: JobContext): Promise<Connection> {
    const connectionId = String(ctx.job.inputRef.connectionId ?? '');
    const [row] = await this.db
      .select({
        id: sourceConnections.id,
        userId: sourceConnections.userId,
        provider: sourceConnections.provider,
        displayHandle: sourceConnections.displayHandle,
      })
      .from(sourceConnections)
      .where(and(eq(sourceConnections.id, connectionId), eq(sourceConnections.userId, ctx.job.userId)));
    if (!row) throw new JobError('permanent', 'SOURCE_GONE', 'That source was removed.');
    await this.db.update(sourceConnections).set({ status: 'syncing', lastErrorCode: null }).where(eq(sourceConnections.id, row.id));
    return { ...row, provider: row.provider as SourceProvider };
  }

  /** Saves a source item (or updates it when it was read before) and returns its ID. */
  protected async saveItem(
    connection: Connection,
    item: {
      providerItemId: string;
      sourceType: 'github_repo' | 'github_contribution' | 'portfolio_page' | 'uploaded_cv' | 'linkedin_profile' | 'pasted_text';
      title: string | null;
      text: string;
      url?: string | null;
      date?: Date | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<string> {
    const result = (await this.db.execute(sql`
      insert into public.source_items
        (user_id, connection_id, source_type, provider_item_id, canonical_url, title, body_text, source_created_at, content_hash, metadata_json)
      values (${connection.userId}, ${connection.id}, ${item.sourceType}, ${item.providerItemId}, ${item.url ?? null}, ${item.title},
              ${item.text}, ${item.date?.toISOString() ?? null}, ${createHash('sha256').update(item.text).digest('hex')},
              ${JSON.stringify(item.metadata ?? {})}::jsonb)
      on conflict (connection_id, provider_item_id) where connection_id is not null and provider_item_id is not null
      do update set body_text = excluded.body_text, title = excluded.title, canonical_url = excluded.canonical_url,
                    source_created_at = excluded.source_created_at, content_hash = excluded.content_hash,
                    metadata_json = excluded.metadata_json, deletion_status = 'active'
      returning id`)) as unknown as RawRows;
    return String(result.rows[0].id);
  }

  protected async finish(ctx: JobContext, connection: Connection, items: IngestItem[]) {
    await ctx.setStep('normalize', 70);
    const { total } = await this.ingest.ingest(connection.userId, connection, items);
    await this.db
      .update(sourceConnections)
      .set({ status: 'synced', lastSyncAt: new Date(), lastErrorCode: null })
      .where(eq(sourceConnections.id, connection.id));
    await this.notifications.notify({
      userId: connection.userId,
      jobId: ctx.job.id,
      template: 'source_ready',
      payload: { provider: connection.provider, entries: total },
      idempotencyKey: `source_ready:${ctx.job.id}`,
    });
    return { entries: total };
  }

  /** Records why a source failed, so its row says so, and turns the error into a job error. */
  protected async fail(connection: Connection, ctx: JobContext, error: unknown): Promise<never> {
    const jobError = toJobError(error, connection.provider);
    await this.db
      .update(sourceConnections)
      .set({ status: jobError.code === 'GITHUB_REAUTH' ? 'needs_reauth' : 'error', lastErrorCode: jobError.code })
      .where(eq(sourceConnections.id, connection.id));
    if (jobError.kind !== 'retryable') {
      await this.notifications.notify({
        userId: connection.userId,
        jobId: ctx.job.id,
        template: 'source_failed',
        payload: { provider: connection.provider, message: jobError.safeMessage },
        idempotencyKey: `source_failed:${ctx.job.id}`,
      });
    }
    throw jobError;
  }
}

function toJobError(error: unknown, provider: SourceProvider): JobError {
  if (error instanceof JobError) return error;
  if (error instanceof UnsafeUrlError) return new JobError('permanent', 'LINK_NOT_READABLE', `${error.message} Check the page is public, or paste the text instead.`);
  if (error instanceof UnreadableFileError) return new JobError('permanent', 'FILE_UNREADABLE', `${error.message} Try a different file, or paste the text instead.`);
  if (error instanceof Error && /rejected the access token/i.test(error.message)) {
    return new JobError('needs_user_action', 'GITHUB_REAUTH', 'GitHub no longer lets us read your account. Reconnect GitHub to continue.');
  }
  return new JobError('retryable', 'SOURCE_FETCH_FAILED', `We could not reach ${provider}. We will try again.`);
}

// ─── source_import: GitHub, portfolio links and pasted text ──────────────────

@Injectable()
export class SourceImportHandler extends ImportHandler {
  constructor(
    @Inject(DB) db: Database,
    @Inject(EvidenceIngestService) ingest: EvidenceIngestService,
    @Inject(NotificationsService) notifications: NotificationsService,
    @Inject(SECRET_BOX) private readonly box: SecretBox,
    @Inject(GITHUB) private readonly github: GithubClient,
    @Inject(SAFE_FETCH) private readonly safeFetch: SafeFetch,
  ) {
    super(db, ingest, notifications);
  }

  handle: JobHandler = async (ctx) => {
    const connection = await this.load(ctx);
    try {
      const items =
        connection.provider === 'github'
          ? await this.collectGithub(connection, ctx)
          : connection.provider === 'portfolio' && connection.displayHandle?.startsWith('http')
            ? await this.collectPortfolio(connection, ctx)
            : await this.collectStored(connection);
      if (items.length === 0) {
        throw new JobError('permanent', 'NOTHING_FOUND', 'We did not find anything to read in that source.');
      }
      return await this.finish(ctx, connection, items);
    } catch (error) {
      return this.fail(connection, ctx, error);
    }
  };

  private async collectGithub(connection: Connection, ctx: JobContext): Promise<IngestItem[]> {
    const [secret] = await this.db
      .select({ token: sourceConnectionSecrets.accessTokenEncrypted })
      .from(sourceConnectionSecrets)
      .where(eq(sourceConnectionSecrets.connectionId, connection.id));
    if (!secret?.token) throw new JobError('needs_user_action', 'GITHUB_REAUTH', 'Reconnect GitHub to continue.');

    const token = this.box.decrypt(secret.token);
    const login = (connection.displayHandle ?? '').replace(/^@/, '');
    const repos = (await this.github.listRepos(token, login)).slice(0, 30);
    const items: IngestItem[] = [];

    for (const [index, repo] of repos.entries()) {
      await ctx.setStep('download_source', 5 + Math.round((index / Math.max(repos.length, 1)) * 60));
      const readme = await this.github.getReadme(token, repo.fullName);
      const text = [repo.description, repo.topics.length ? `Topics: ${repo.topics.join(', ')}` : null, readme?.slice(0, 4000)]
        .filter(Boolean)
        .join('\n\n');
      if (!text.trim()) continue;

      const projectKey = repo.name.toLowerCase();
      const date = repo.pushedAt ? new Date(repo.pushedAt) : null;
      const hint = [...new Set([repo.language ? findSkills(repo.language)[0] ?? repo.language : null, ...repo.topics.flatMap((topic) => findSkills(topic))].filter((skill): skill is string => Boolean(skill)))];
      const id = await this.saveItem(connection, {
        providerItemId: String(repo.id),
        sourceType: 'github_repo',
        title: repo.name,
        text,
        url: repo.url,
        date,
        metadata: { language: repo.language, topics: repo.topics, stars: repo.stars },
      });
      items.push({
        sourceItemId: id,
        document: { id, provider: 'github', kind: 'github_repo', title: repo.name, text, url: repo.url, date, where: repo.name, projectKey, skillsHint: hint },
      });

      // Releases show what shipped, for the most recent repositories.
      if (index < 8) {
        for (const release of await this.github.listReleases(token, repo.fullName, 2)) {
          const body = (release.body ?? '').trim();
          if (body.length < 40) continue;
          const releaseText = `${repo.name} ${release.name ?? release.tag}: ${body.slice(0, 1500)}`;
          const releaseDate = release.publishedAt ? new Date(release.publishedAt) : null;
          const releaseId = await this.saveItem(connection, {
            providerItemId: `release-${release.id}`,
            sourceType: 'github_contribution',
            title: `${repo.name} ${release.tag}`,
            text: releaseText,
            url: release.url,
            date: releaseDate,
          });
          items.push({
            sourceItemId: releaseId,
            document: { id: releaseId, provider: 'github', kind: 'github_contribution', title: `${repo.name} ${release.tag}`, text: releaseText, url: release.url, date: releaseDate, where: repo.name, projectKey, skillsHint: hint },
          });
        }
      }
    }
    return items;
  }

  private async collectPortfolio(connection: Connection, ctx: JobContext): Promise<IngestItem[]> {
    await ctx.setStep('download_source', 20);
    const response = await this.safeFetch.request(connection.displayHandle!);
    if (response.status >= 400) {
      throw new JobError('permanent', 'LINK_NOT_READABLE', 'The page returned an error. Check it is public, or paste the text instead.');
    }
    const isHtml = /html/i.test(response.contentType) || /<html|<body|<div/i.test(response.text.slice(0, 2000));
    const text = isHtml ? htmlToText(response.text) : response.text.trim();
    if (text.length < 80) {
      throw new JobError('permanent', 'LINK_EMPTY', 'We could not find readable text on that page. Paste the text instead.');
    }
    const title = response.text.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? new URL(response.finalUrl).hostname;
    const id = await this.saveItem(connection, {
      providerItemId: 'page',
      sourceType: 'portfolio_page',
      title,
      text: text.slice(0, 60_000),
      url: response.finalUrl,
    });
    return [{ sourceItemId: id, document: { id, provider: 'portfolio', kind: 'portfolio_page', title, text: text.slice(0, 60_000), url: response.finalUrl, date: null, where: new URL(response.finalUrl).hostname } }];
  }

  /** Text the person pasted: already stored, so it only needs reading. */
  private async collectStored(connection: Connection): Promise<IngestItem[]> {
    const rows = await this.db
      .select({ id: sourceItems.id, title: sourceItems.title, text: sourceItems.bodyText, type: sourceItems.sourceType })
      .from(sourceItems)
      .where(and(eq(sourceItems.connectionId, connection.id), isNotNull(sourceItems.bodyText)));
    return rows.map((row) => ({
      sourceItemId: row.id,
      document: {
        id: row.id,
        provider: connection.provider,
        kind: row.type,
        title: row.title,
        text: row.text ?? '',
        url: null,
        date: null,
        where: row.title,
      } satisfies SourceDocument,
    }));
  }
}

// ─── cv_parse: uploaded CVs and LinkedIn exports ─────────────────────────────

@Injectable()
export class CvParseHandler extends ImportHandler {
  constructor(
    @Inject(DB) db: Database,
    @Inject(EvidenceIngestService) ingest: EvidenceIngestService,
    @Inject(NotificationsService) notifications: NotificationsService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {
    super(db, ingest, notifications);
  }

  handle: JobHandler = async (ctx) => {
    const connection = await this.load(ctx);
    try {
      const [file] = await this.db
        .select({ id: sourceItems.id, key: sourceItems.rawObjectKey, title: sourceItems.title })
        .from(sourceItems)
        .where(and(eq(sourceItems.connectionId, connection.id), isNotNull(sourceItems.rawObjectKey)))
        .limit(1);
      if (!file?.key) throw new JobError('permanent', 'FILE_MISSING', 'We no longer have that file. Upload it again.');

      await ctx.setStep('parse_cv', 15);
      const buffer = await this.storage.get(file.key);
      const items = await this.read(connection, file.id, file.title ?? 'file', buffer);
      return await this.finish(ctx, connection, items);
    } catch (error) {
      return this.fail(connection, ctx, error);
    }
  };

  private async read(connection: Connection, fileItemId: string, name: string, buffer: Buffer): Promise<IngestItem[]> {
    const kind = detectFileKind(buffer);
    const isLinkedin = connection.provider === 'linkedin';

    // A LinkedIn export is an archive of tables; anything else is read as one document.
    if (isLinkedin && kind === 'zip') {
      const parsed = parseLinkedinExport(buffer);
      const items: IngestItem[] = [];
      for (const [index, doc] of parsed.entries()) {
        const id = await this.saveItem(connection, {
          providerItemId: `linkedin-${index}`,
          sourceType: 'linkedin_profile',
          title: doc.title,
          text: doc.text,
          date: doc.date,
        });
        items.push({ sourceItemId: id, document: { id, provider: 'linkedin', kind: 'linkedin_profile', title: doc.title, text: doc.text, url: null, date: doc.date, where: doc.title } });
      }
      return items;
    }

    const text = kind === 'pdf' ? await extractPdfText(buffer) : await extractDocxText(buffer);
    if (text.length < 100) {
      throw new JobError('permanent', 'FILE_EMPTY', 'We could not find text in that file. If it is a scan, paste the text instead.');
    }
    await this.db.update(sourceItems).set({ bodyText: text }).where(eq(sourceItems.id, fileItemId));
    return [
      {
        sourceItemId: fileItemId,
        document: {
          id: fileItemId,
          provider: connection.provider,
          kind: isLinkedin ? 'linkedin_profile' : 'uploaded_cv',
          title: name,
          text,
          url: null,
          date: null,
          where: name,
        },
      },
    ];
  }
}
