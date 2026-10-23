import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { ApiError, JobError, ROLE_IDS, type RoleId } from '@tracck/shared';
import type { AiEngine, JobReading } from '../ai/ai-engine';
import { EntitlementsService } from '../core/entitlements.service';
import { JobDispatcher } from '../core/job-dispatcher.service';
import { NotificationsService } from '../core/notifications.service';
import type { Database } from '../db';
import { generationRuns, resumeDocuments, resumeVersions, targetOpportunities } from '../db/schema';
import type { JobContext, JobHandler } from '../jobs/runner';
import { AI_ENGINE, DB } from '../tokens';
import { buildMatch, plainText } from './content';
import { EvidenceSelector } from './evidence-selector';

const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;
const asRole = (value: string | null | undefined): RoleId | null =>
  (ROLE_IDS as readonly string[]).includes(value ?? '') ? (value as RoleId) : null;

/** What is stored of the job so a later edit can rebuild the match report without asking the engine. */
export interface StoredReading {
  required: string[];
  preferred: string[];
  roleId: RoleId | null;
}

/** Turns a queued generation run into a resume version: read the job, pick evidence, write, check, save. */
@Injectable()
export class ResumeGenerationHandler {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AI_ENGINE) private readonly ai: AiEngine,
    @Inject(EvidenceSelector) private readonly selector: EvidenceSelector,
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(JobDispatcher) private readonly jobs: JobDispatcher,
  ) {}

  handle: JobHandler = async (ctx) => {
    const runId = String(ctx.job.inputRef.runId ?? '');
    const [run] = await this.db
      .select()
      .from(generationRuns)
      .where(and(eq(generationRuns.id, runId), eq(generationRuns.userId, ctx.job.userId)));
    if (!run?.resumeDocumentId) throw new JobError('permanent', 'RESUME_GONE', 'That resume was deleted.');

    try {
      return await this.run(ctx, run.id, run.resumeDocumentId);
    } catch (error) {
      const jobError = toJobError(error);
      const final = jobError.kind !== 'retryable' || ctx.job.attemptCount >= ctx.job.maxAttempts;
      if (final) await this.fail(ctx, run.id, run.resumeDocumentId, jobError);
      throw jobError;
    }
  };

  private async run(ctx: JobContext, runId: string, resumeId: string) {
    const userId = ctx.job.userId;
    await this.db
      .update(generationRuns)
      .set({ status: 'running', startedAt: new Date(), backgroundJobId: ctx.job.id })
      .where(eq(generationRuns.id, runId));

    const [{ doc, opportunity, run }] = await this.db
      .select({ doc: resumeDocuments, opportunity: targetOpportunities, run: generationRuns })
      .from(generationRuns)
      .innerJoin(resumeDocuments, eq(resumeDocuments.id, generationRuns.resumeDocumentId))
      .leftJoin(targetOpportunities, eq(targetOpportunities.id, resumeDocuments.targetOpportunityId))
      .where(eq(generationRuns.id, runId));
    if (!opportunity) throw new JobError('permanent', 'RESUME_GONE', 'That resume was deleted.');

    const focus = (run.userFocusJson.focus as string | null) ?? null;
    const contact = String(run.userFocusJson.contact ?? '');

    await ctx.setStep('retrieve', 15);
    const reading: JobReading = await this.ai.parseJob(opportunity.jobDescriptionText);
    const roleId = asRole(doc.roleId) ?? reading.roleId;
    await this.db
      .update(targetOpportunities)
      .set({
        roleFamily: roleId,
        requirementsJson: [
          ...reading.required.map((label) => ({ label, importance: 'required' })),
          ...reading.preferred.map((label) => ({ label, importance: 'preferred' })),
        ],
      })
      .where(eq(targetOpportunities.id, opportunity.id));

    const evidence = await this.selector.select({
      userId,
      description: opportunity.jobDescriptionText,
      reading,
      providers: doc.sourceSelection,
      focus,
    });
    if (evidence.length === 0) {
      throw new JobError('needs_user_action', 'NO_EVIDENCE', 'There is nothing to write from yet. Connect a source or add an entry, then try again.');
    }

    await ctx.setStep('draft', 40);
    const [profile] = rowsOf<{ name: string | null }>(
      await this.db.execute(sql`select display_name as name from public.profiles where id = ${userId}`),
    );
    const draft = await this.ai.generateResume({
      userId,
      person: { name: profile?.name ?? 'Your name', contact },
      job: { ...reading, title: opportunity.title, company: opportunity.company, description: opportunity.jobDescriptionText },
      focus,
      length: doc.length,
      roleId,
      evidence,
    });

    await ctx.setStep('validate', 85);
    const stored: StoredReading = { required: reading.required, preferred: reading.preferred, roleId };
    const match = buildMatch({ content: draft.content, reading, engineScore: draft.review?.score ?? null, length: doc.length });

    const versionId = await this.db.transaction(async (tx) => {
      const [{ next }] = rowsOf<{ next: number }>(
        await tx.execute(sql`select coalesce(max(version_number), 0)::int + 1 as next from public.resume_versions where resume_document_id = ${resumeId}`),
      );
      const [version] = await tx
        .insert(resumeVersions)
        .values({
          resumeDocumentId: resumeId,
          versionNumber: next,
          contentJson: draft.content as unknown as Record<string, unknown>,
          plainText: plainText(draft.content),
          generationRunId: runId,
          createdBy: 'ai',
          validationSummaryJson: { match, reading: stored, review: draft.review ?? null },
        })
        .returning({ id: resumeVersions.id });
      await tx
        .update(resumeDocuments)
        .set({ currentVersionId: version.id, status: 'draft', engine: this.ai.name, roleId })
        .where(eq(resumeDocuments.id, resumeId));
      await tx
        .update(generationRuns)
        .set({
          status: 'succeeded',
          completedAt: new Date(),
          retrievedEvidenceIds: draft.usedEvidenceIds,
          reviewJson: (draft.review ?? {}) as Record<string, unknown>,
          modelProvider: this.ai.name,
        })
        .where(eq(generationRuns.id, runId));
      return version.id;
    });

    await this.notifications.notify({
      userId,
      jobId: ctx.job.id,
      template: 'resume_ready',
      payload: { resumeId, title: doc.title, company: doc.company },
      idempotencyKey: `resume_ready:${ctx.job.id}`,
    });
    await this.tellOrganisation(ctx, runId, 'resume.completed', resumeId);
    return { resumeId, versionId };
  }

  /** A run that cannot finish gives the person their resume back for the month. */
  private async fail(ctx: JobContext, runId: string, resumeId: string, error: JobError) {
    await this.db
      .update(generationRuns)
      .set({ status: 'failed', failureCode: error.code, completedAt: new Date() })
      .where(eq(generationRuns.id, runId));
    const [doc] = await this.db.select({ current: resumeDocuments.currentVersionId }).from(resumeDocuments).where(eq(resumeDocuments.id, resumeId));
    // A regeneration that fails leaves the earlier draft in place.
    await this.db
      .update(resumeDocuments)
      .set({ status: doc?.current ? 'draft' : 'failed' })
      .where(eq(resumeDocuments.id, resumeId));
    // Organisation-made resumes are not on the person's plan, so there is nothing to give back.
    const [run] = await this.db.select({ focus: generationRuns.userFocusJson }).from(generationRuns).where(eq(generationRuns.id, runId));
    if (!run?.focus.orgClientId) await this.entitlements.refundResume(ctx.job.userId);
    await this.tellOrganisation(ctx, runId, 'resume.failed', resumeId);
  }

  /** When an organisation asked for this resume, it hears how it went through its webhook. */
  private async tellOrganisation(ctx: JobContext, runId: string, event: 'resume.completed' | 'resume.failed', resumeId: string) {
    const [run] = await this.db.select({ focus: generationRuns.userFocusJson }).from(generationRuns).where(eq(generationRuns.id, runId));
    const clientId = run?.focus.orgClientId;
    if (typeof clientId !== 'string') return;
    await this.jobs
      .dispatch({
        userId: ctx.job.userId,
        jobType: 'webhook_delivery',
        idempotencyKey: `webhook:${event}:${ctx.job.id}`,
        input: { clientId, event, jobId: ctx.job.id, resumeId },
      })
      .catch(() => {});
  }
}

function toJobError(error: unknown): JobError {
  if (error instanceof JobError) return error;
  if (error instanceof ApiError) {
    if (error.code === 'NOT_CONFIGURED') return new JobError('permanent', 'NOT_CONFIGURED', error.message);
    if (error.status >= 400 && error.status < 500) return new JobError('permanent', error.code, error.message);
  }
  return new JobError('retryable', 'GENERATION_FAILED', 'We could not finish this resume. We will try again.');
}
