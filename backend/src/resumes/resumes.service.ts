import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import {
  ApiError,
  POLICY_PURPOSES,
  POLICY_TEXT_VERSION,
  ROLE_IDS,
  type CreateResumeRequest,
  type CreateResumeResponse,
  type EditBulletRequest,
  type ExportLinkResponse,
  type ExportResponse,
  type MatchReport,
  type Page,
  type ParseJobResponse,
  type PersonDetails,
  type ResumeContent,
  type ResumeDetailView,
  type ResumeStatus,
  type ResumeSummaryView,
  type ResumeVersionView,
  type RoleId,
} from '@tracck/shared';
import type { AiEngine } from '../ai/ai-engine';
import { AuditService } from '../core/audit.service';
import { EntitlementsService } from '../core/entitlements.service';
import { JobDispatcher } from '../core/job-dispatcher.service';
import type { Database } from '../db';
import { generationRuns, profiles, resumeDocuments, resumeVersions, targetOpportunities, userPolicyConsents } from '../db/schema';
import { DEFAULT_TEMPLATE, getTemplate } from '../templates/registry';
import type { ObjectStorage } from '../storage/storage';
import { AI_ENGINE, DB, STORAGE } from '../tokens';
import { buildMatch, cloneContent, findBullet, groupAt, plainText } from './content';
import type { StoredReading } from './generation.handler';

const PAGE_SIZE = 30;
const EXPORT_LINK_SECONDS = 300;
const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;
const asRole = (value: string | null): RoleId | null => ((ROLE_IDS as readonly string[]).includes(value ?? '') ? (value as RoleId) : null);

/** The same key from the same person always names the same record, so a repeated request finds it. */
function stableId(userId: string, key: string, scope: string): string {
  const hex = createHash('sha256').update(`${scope}:${userId}:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const titleFrom = (description: string) => {
  const line = description.split('\n').map((l) => l.trim()).find((l) => l.length > 3) ?? 'Untitled role';
  return line.length > 80 ? `${line.slice(0, 77).trimEnd()}...` : line;
};

interface SummaryRow {
  id: string;
  title: string;
  company: string | null;
  role: string | null;
  length: 'one_page' | 'full';
  status: 'generating' | 'draft' | 'ready' | 'failed' | 'archived';
  exported: boolean;
  created_at: string;
  score: number | null;
  new_entries: number;
  job_id: string | null;
}

const toSummary = (row: SummaryRow): ResumeSummaryView => ({
  id: row.id,
  company: row.company,
  title: row.title,
  role: asRole(row.role),
  length: row.length,
  score: row.score,
  createdAt: new Date(row.created_at).toISOString(),
  status: (row.status === 'generating' || row.status === 'failed' ? row.status : row.exported ? 'exported' : 'draft') as ResumeStatus,
  newEntries: row.new_entries,
  jobId: row.status === 'generating' ? row.job_id : null,
});

const SUMMARY_SQL = sql`
  d.id, d.title, d.company, d.role_id as role, d.length, d.status,
  (d.last_exported_at is not null) as exported, d.created_at,
  (v.validation_summary_json -> 'match' ->> 'score')::int as score,
  (select count(*)::int from public.candidate_evidence e
    where e.user_id = d.user_id and not e.excluded and e.created_at > d.created_at) as new_entries,
  (select r.background_job_id from public.generation_runs r
    where r.resume_document_id = d.id order by r.created_at desc limit 1) as job_id`;

@Injectable()
export class ResumesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AI_ENGINE) private readonly ai: AiEngine,
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
    @Inject(JobDispatcher) private readonly jobs: JobDispatcher,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async parseJob(description: string): Promise<ParseJobResponse> {
    const reading = await this.ai.parseJob(description);
    return { required: reading.required, preferred: reading.preferred, roleId: reading.roleId };
  }

  // ─── Creating ──────────────────────────────────────────────────────────────

  async create(
    userId: string,
    email: string | null,
    input: CreateResumeRequest,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<CreateResumeResponse> {
    const resumeId = stableId(userId, idempotencyKey, 'resume');
    const [existing] = await this.db.select({ id: resumeDocuments.id }).from(resumeDocuments).where(eq(resumeDocuments.id, resumeId));

    if (!existing) {
      await this.assertPolicyAccepted(userId);
      await this.entitlements.assertCanGenerate(userId, input.length);
      await this.assertHasEvidence(userId);
      await this.insertResume(userId, email, resumeId, input);
      await this.entitlements.recordResume(userId);
      await this.audit.record({ userId, eventType: 'resume.created', subjectType: 'resume', subjectId: resumeId, correlationId });
    }
    return this.start(userId, resumeId, idempotencyKey, correlationId);
  }
  private async insertResume(userId: string, email: string | null, resumeId: string, input: CreateResumeRequest) {
    const [profile] = await this.db.select().from(profiles).where(eq(profiles.id, userId));
    const person: PersonDetails = {
      name: profile?.displayName ?? 'Your name',
      email,
      phone: profile?.phone ?? null,
      location: profile?.location ?? null,
      address: profile?.address ?? null,
      dateOfBirth: profile?.dateOfBirth ?? null,
      nationality: profile?.nationality ?? null,
    };
    const template = getTemplate(input.templateId ?? DEFAULT_TEMPLATE.id);

    await this.db.transaction(async (tx) => {
      const [opportunity] = await tx
        .insert(targetOpportunities)
        .values({
          userId,
          title: input.title?.trim() || titleFrom(input.jobDescription),
          company: input.company?.trim() || null,
          jobDescriptionText: input.jobDescription,
          roleFamily: input.roleId ?? null,
        })
        .returning({ id: targetOpportunities.id });
      await tx.insert(resumeDocuments).values({
        id: resumeId,
        userId,
        targetOpportunityId: opportunity.id,
        title: input.title?.trim() || titleFrom(input.jobDescription),
        company: input.company?.trim() || null,
        status: 'generating',
        length: input.length,
        roleId: input.roleId ?? null,
        sourceSelection: input.sources ?? [],
        focus: input.focus?.trim() || null,
        engine: this.ai.name,
      });
      await tx.insert(generationRuns).values({
        id: stableId(userId, resumeId, 'run:first'),
        userId,
        targetOpportunityId: opportunity.id,
        resumeDocumentId: resumeId,
        userFocusJson: {
          focus: input.focus?.trim() || null,
          instructions: input.instructions?.trim() || null,
          templateId: template.id,
          person,
        },
      });
    });
  }

  /** Puts a queued run on the queue. A repeat of the same request finds the job it already made. */
  private async start(userId: string, resumeId: string, idempotencyKey: string, correlationId: string, runId?: string) {
    const run =
      runId ??
      rowsOf<{ id: string }>(
        await this.db.execute(sql`select id from public.generation_runs where resume_document_id = ${resumeId} and user_id = ${userId} order by created_at desc limit 1`),
      )[0].id;
    const { job } = await this.jobs.dispatch({
      userId,
      jobType: 'resume_generation',
      idempotencyKey: `resume:${idempotencyKey}`,
      input: { resumeId, runId: run },
      correlationId,
    });
    await this.db.update(generationRuns).set({ backgroundJobId: job.id }).where(eq(generationRuns.id, run));
    return { resumeId, jobId: job.id, ...this.jobs.statusUrls(job.id) };
  }

  private async assertPolicyAccepted(userId: string) {
    const rows = await this.db
      .select({ purpose: userPolicyConsents.purpose })
      .from(userPolicyConsents)
      .where(and(eq(userPolicyConsents.userId, userId), eq(userPolicyConsents.textVersion, POLICY_TEXT_VERSION)));
    if (!POLICY_PURPOSES.every((purpose) => rows.some((row) => row.purpose === purpose))) {
      throw new ApiError(403, 'CONSENT_REQUIRED', 'Agree to how Tracck uses your entries before writing a resume.');
    }
  }

  private async assertHasEvidence(userId: string) {
    const [row] = rowsOf<{ n: number }>(
      await this.db.execute(sql`select count(*)::int as n from public.candidate_evidence where user_id = ${userId} and not excluded`),
    );
    if (!row?.n) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Your record is empty. Connect a source or add an entry first.');
    }
  }

  /** Writes the resume again from the person's latest record. The earlier draft stays as a version. */
  async regenerate(userId: string, resumeId: string, idempotencyKey: string, correlationId: string): Promise<CreateResumeResponse> {
    const [doc] = await this.db
      .select({ length: resumeDocuments.length, status: resumeDocuments.status })
      .from(resumeDocuments)
      .where(and(eq(resumeDocuments.id, resumeId), eq(resumeDocuments.userId, userId)));
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'We could not find that resume.');

    const runId = stableId(userId, idempotencyKey, 'run');
    const [known] = await this.db.select({ id: generationRuns.id }).from(generationRuns).where(eq(generationRuns.id, runId));
    if (!known) {
      if (doc.status === 'generating') throw new ApiError(409, 'CONFLICT', 'This resume is still being written.');
      await this.entitlements.assertCanGenerate(userId, doc.length);
      const [first] = await this.db.select().from(generationRuns).where(eq(generationRuns.resumeDocumentId, resumeId)).limit(1);
      await this.db.insert(generationRuns).values({
        id: runId,
        userId,
        targetOpportunityId: first?.targetOpportunityId,
        resumeDocumentId: resumeId,
        userFocusJson: first?.userFocusJson ?? {},
      });
      await this.db.update(resumeDocuments).set({ status: 'generating' }).where(eq(resumeDocuments.id, resumeId));
      await this.entitlements.recordResume(userId);
    }
    return this.start(userId, resumeId, idempotencyKey, correlationId, runId);
  }

  // ─── Reading ───────────────────────────────────────────────────────────────

  async list(
    userId: string,
    query: { q?: string; status?: ResumeStatus; cursor?: string; limit?: number },
  ): Promise<Page<ResumeSummaryView>> {
    const limit = Math.min(query.limit ?? PAGE_SIZE, 100);
    const search = query.q ? `%${query.q.replace(/[\\%_]/g, '\\$&')}%` : null;
    const cursor = decodeCursor(query.cursor);
    const status = query.status ?? null;

    const rows = rowsOf<SummaryRow>(
      await this.db.execute(sql`
        select ${SUMMARY_SQL}
          from public.resume_documents d
          left join public.resume_versions v on v.id = d.current_version_id
         where d.user_id = ${userId} and d.status <> 'archived'
           and (${search}::text is null or d.title ilike ${search} or d.company ilike ${search})
           and (${status}::text is null
                or (${status} = 'generating' and d.status = 'generating')
                or (${status} = 'failed' and d.status = 'failed')
                or (${status} = 'exported' and d.status in ('draft', 'ready') and d.last_exported_at is not null)
                or (${status} = 'draft' and d.status in ('draft', 'ready') and d.last_exported_at is null))
           and (${cursor?.at ?? null}::timestamptz is null
                or (d.created_at, d.id) < (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
         order by d.created_at desc, d.id desc
         limit ${limit + 1}`),
    );
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map(toSummary),
      nextCursor: rows.length > limit && last ? encodeCursor(last.created_at, last.id) : null,
    };
  }

  async detail(userId: string, resumeId: string): Promise<ResumeDetailView> {
    const [row] = rowsOf<
      SummaryRow & {
        focus: string | null;
        engine: string;
        description: string | null;
        version_number: number | null;
        saved_at: string | null;
        content: ResumeContent | null;
        summary: { match?: MatchReport } | null;
        pdf: string | null;
        docx: string | null;
      }
    >(
      await this.db.execute(sql`
        select ${SUMMARY_SQL}, d.focus, d.engine, o.job_description_text as description,
               v.version_number, v.created_at as saved_at, v.content_json as content,
               v.validation_summary_json as summary, v.pdf_object_key as pdf, v.docx_object_key as docx
          from public.resume_documents d
          left join public.resume_versions v on v.id = d.current_version_id
          left join public.target_opportunities o on o.id = d.target_opportunity_id
         where d.id = ${resumeId} and d.user_id = ${userId}`),
    );
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'We could not find that resume.');

    return {
      ...toSummary(row),
      version: row.version_number ?? 0,
      savedAt: new Date(row.saved_at ?? row.created_at).toISOString(),
      content: row.content,
      match: row.summary?.match ?? null,
      job: { description: row.description ?? '', focus: row.focus },
      engine: row.engine,
      exports: { pdf: Boolean(row.pdf), docx: Boolean(row.docx) },
    };
  }

  async versions(userId: string, resumeId: string): Promise<ResumeVersionView[]> {
    await this.owned(userId, resumeId);
    const rows = await this.db
      .select({ id: resumeVersions.id, number: resumeVersions.versionNumber, createdAt: resumeVersions.createdAt, createdBy: resumeVersions.createdBy })
      .from(resumeVersions)
      .where(eq(resumeVersions.resumeDocumentId, resumeId))
      .orderBy(sql`${resumeVersions.versionNumber} desc`);
    return rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }));
  }

  private async owned(userId: string, resumeId: string) {
    const [doc] = await this.db
      .select({ id: resumeDocuments.id, status: resumeDocuments.status, length: resumeDocuments.length })
      .from(resumeDocuments)
      .where(and(eq(resumeDocuments.id, resumeId), eq(resumeDocuments.userId, userId)));
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'We could not find that resume.');
    return doc;
  }

  // ─── Editing ───────────────────────────────────────────────────────────────

  async editBullet(userId: string, resumeId: string, bulletId: string, input: EditBulletRequest): Promise<ResumeDetailView> {
    return this.change(userId, resumeId, input.version, (content) => {
      const location = findBullet(content, bulletId);
      if (!location) throw new ApiError(404, 'NOT_FOUND', 'We could not find that bullet.');
      const { bullet } = location;

      if (input.text !== undefined) bullet.text = input.text.trim();
      if (input.figure !== undefined) bullet.text = `${bullet.text.replace(/[.\s]+$/, '')}, ${input.figure.trim().replace(/[.\s]+$/, '')}.`;
      // Whatever the person decided about the figure, the warning has been answered.
      if (input.text !== undefined || input.figure !== undefined || input.keepWithoutFigure) delete bullet.needsNumber;
    });
  }

  async moveBullet(userId: string, resumeId: string, bulletId: string, version: number): Promise<ResumeDetailView> {
    return this.change(userId, resumeId, version, (content) => {
      const location = findBullet(content, bulletId);
      if (!location) throw new ApiError(404, 'NOT_FOUND', 'We could not find that bullet.');
      if (location.index === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'That bullet is already first in its group.');
      const { bullets } = groupAt(content, location);
      [bullets[location.index - 1], bullets[location.index]] = [bullets[location.index], bullets[location.index - 1]];
    });
  }

  async removeBullet(userId: string, resumeId: string, bulletId: string, version: number): Promise<ResumeDetailView> {
    return this.change(userId, resumeId, version, (content) => {
      const location = findBullet(content, bulletId);
      if (!location) throw new ApiError(404, 'NOT_FOUND', 'We could not find that bullet.');
      const section = content.sections[location.section];
      if (section.kind !== 'groups') return;
      section.groups[location.group].bullets.splice(location.index, 1);
      section.groups = section.groups.filter((group) => group.bullets.length > 0);
    });
  }

  /** Brings back an earlier version as the newest one. Nothing is lost: the versions in between stay. */
  async restore(userId: string, resumeId: string, versionNumber: number): Promise<ResumeDetailView> {
    await this.owned(userId, resumeId);
    const [old] = await this.db
      .select({ content: resumeVersions.contentJson, summary: resumeVersions.validationSummaryJson })
      .from(resumeVersions)
      .where(and(eq(resumeVersions.resumeDocumentId, resumeId), eq(resumeVersions.versionNumber, versionNumber)));
    if (!old) throw new ApiError(404, 'NOT_FOUND', 'We could not find that version.');
    await this.saveVersion(resumeId, old.content as unknown as ResumeContent, old.summary, 'user');
    return this.detail(userId, resumeId);
  }

  /** Applies one edit to the current version and saves the result as the next one. */
  private async change(userId: string, resumeId: string, seen: number, edit: (content: ResumeContent) => void) {
    const doc = await this.owned(userId, resumeId);
    if (doc.status === 'generating') throw new ApiError(409, 'CONFLICT', 'This resume is still being written.');

    const [current] = rowsOf<{ number: number; content: ResumeContent; summary: { reading?: StoredReading } }>(
      await this.db.execute(sql`
        select v.version_number as number, v.content_json as content, v.validation_summary_json as summary
          from public.resume_documents d join public.resume_versions v on v.id = d.current_version_id
         where d.id = ${resumeId}`),
    );
    if (!current) throw new ApiError(409, 'CONFLICT', 'This resume has no draft yet.');
    if (current.number !== seen) {
      throw new ApiError(409, 'VERSION_CONFLICT', 'This resume changed somewhere else. Reload to see the latest version.');
    }

    const content = cloneContent(current.content);
    edit(content);
    const reading = current.summary.reading ?? { required: [], preferred: [], roleId: null };
    const match = buildMatch({ content, reading, engineScore: null, length: doc.length });
    await this.saveVersion(resumeId, content, { ...current.summary, match }, 'user', current.number + 1);
    return this.detail(userId, resumeId);
  }

  private async saveVersion(resumeId: string, content: ResumeContent, summary: Record<string, unknown>, createdBy: 'ai' | 'user', expected?: number) {
    try {
      await this.db.transaction(async (tx) => {
        const [{ next }] = rowsOf<{ next: number }>(
          await tx.execute(sql`select coalesce(max(version_number), 0)::int + 1 as next from public.resume_versions where resume_document_id = ${resumeId}`),
        );
        // Two edits that raced: the second one saw an older version.
        if (expected !== undefined && next !== expected) throw new ApiError(409, 'VERSION_CONFLICT', 'This resume changed somewhere else. Reload to see the latest version.');
        const [version] = await tx
          .insert(resumeVersions)
          .values({ resumeDocumentId: resumeId, versionNumber: next, contentJson: content as unknown as Record<string, unknown>, plainText: plainText(content), createdBy, validationSummaryJson: summary })
          .returning({ id: resumeVersions.id });
        await tx.update(resumeDocuments).set({ currentVersionId: version.id }).where(eq(resumeDocuments.id, resumeId));
      });
    } catch (error) {
      // The unique (resume, number) constraint is the last guard against a race.
      if (error instanceof Error && /resume_versions_resume_document_id_version_number/.test(`${error.message} ${(error as { cause?: Error }).cause?.message ?? ''}`)) {
        throw new ApiError(409, 'VERSION_CONFLICT', 'This resume changed somewhere else. Reload to see the latest version.');
      }
      throw error;
    }
  }

  // ─── Exporting ─────────────────────────────────────────────────────────────

  async requestExport(userId: string, resumeId: string, format: 'pdf' | 'docx', idempotencyKey: string, correlationId: string): Promise<ExportResponse> {
    await this.entitlements.assertCanExport(userId, format);
    const [doc] = await this.db
      .select({ versionId: resumeDocuments.currentVersionId, status: resumeDocuments.status })
      .from(resumeDocuments)
      .where(and(eq(resumeDocuments.id, resumeId), eq(resumeDocuments.userId, userId)));
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'We could not find that resume.');
    if (!doc.versionId || doc.status === 'generating') throw new ApiError(409, 'CONFLICT', 'This resume is not ready to export yet.');

    const { job } = await this.jobs.dispatch({
      userId,
      jobType: 'resume_export',
      idempotencyKey: `export:${idempotencyKey}`,
      input: { resumeId, versionId: doc.versionId, format },
      correlationId,
    });
    return { jobId: job.id, ...this.jobs.statusUrls(job.id) };
  }

  async exportLink(userId: string, resumeId: string, format: 'pdf' | 'docx'): Promise<ExportLinkResponse> {
    await this.entitlements.assertCanExport(userId, format);
    const [row] = rowsOf<{ key: string | null }>(
      await this.db.execute(sql`
        select ${sql.raw(format === 'pdf' ? 'v.pdf_object_key' : 'v.docx_object_key')} as key
          from public.resume_documents d join public.resume_versions v on v.id = d.current_version_id
         where d.id = ${resumeId} and d.user_id = ${userId}`),
    );
    if (!row?.key) throw new ApiError(404, 'NOT_FOUND', 'Export this version first, then download it.');
    return {
      url: await this.storage.signedUrl(row.key, EXPORT_LINK_SECONDS),
      expiresAt: new Date(Date.now() + EXPORT_LINK_SECONDS * 1000).toISOString(),
    };
  }

  // ─── Deleting ──────────────────────────────────────────────────────────────

  async remove(userId: string, resumeId: string, correlationId: string): Promise<void> {
    await this.owned(userId, resumeId);
    await this.storage.removePrefix(`users/${userId}/resumes/${resumeId}/`).catch(() => {});
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        delete from public.target_opportunities o using public.resume_documents d
         where d.target_opportunity_id = o.id and d.id = ${resumeId} and d.user_id = ${userId}`);
      await tx.delete(resumeDocuments).where(and(eq(resumeDocuments.id, resumeId), eq(resumeDocuments.userId, userId)));
    });
    await this.audit.record({ userId, eventType: 'resume.deleted', subjectType: 'resume', subjectId: resumeId, correlationId });
  }

  async removeAll(userId: string, correlationId: string): Promise<void> {
    await this.storage.removePrefix(`users/${userId}/resumes/`).catch(() => {});
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`delete from public.target_opportunities where user_id = ${userId}`);
      await tx.delete(resumeDocuments).where(eq(resumeDocuments.userId, userId));
    });
    await this.audit.record({ userId, eventType: 'resume.deleted_all', correlationId });
  }
}

function encodeCursor(createdAt: string, id: string) {
  return Buffer.from(`${new Date(createdAt).toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string | undefined): { at: string; id: string } | null {
  if (!cursor) return null;
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (!at || !id || Number.isNaN(Date.parse(at))) throw new ApiError(400, 'VALIDATION_ERROR', 'That page link is not valid.');
  return { at, id };
}


