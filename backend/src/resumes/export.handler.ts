import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { JobError, type ResumeContent } from '@tracck/shared';
import { NotificationsService } from '../core/notifications.service';
import type { Database } from '../db';
import { resumeDocuments, resumeVersions } from '../db/schema';
import type { JobHandler } from '../jobs/runner';
import type { ObjectStorage } from '../storage/storage';
import { DB, STORAGE } from '../tokens';
import { renderDocx, renderPdf } from './renderers';

const TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

export const exportKey = (userId: string, resumeId: string, versionNumber: number, format: 'pdf' | 'docx') =>
  `users/${userId}/resumes/${resumeId}/v${versionNumber}.${format}`;

/** Builds a PDF or Word file from one version of a resume and stores it privately. */
@Injectable()
export class ResumeExportHandler {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  handle: JobHandler = async (ctx) => {
    const { resumeId, versionId } = ctx.job.inputRef as { resumeId: string; versionId: string };
    const format = ctx.job.inputRef.format === 'docx' ? 'docx' : 'pdf';
    const userId = ctx.job.userId;

    const [row] = await this.db
      .select({ version: resumeVersions, title: resumeDocuments.title })
      .from(resumeVersions)
      .innerJoin(resumeDocuments, eq(resumeDocuments.id, resumeVersions.resumeDocumentId))
      .where(and(eq(resumeVersions.id, versionId), eq(resumeDocuments.id, resumeId), eq(resumeDocuments.userId, userId)));
    if (!row) throw new JobError('permanent', 'RESUME_GONE', 'That resume was deleted.');

    await ctx.setStep('export', 30);
    const content = row.version.contentJson as unknown as ResumeContent;
    const file = format === 'pdf' ? await renderPdf(content) : await renderDocx(content);

    const key = exportKey(userId, resumeId, row.version.versionNumber, format);
    await this.storage.put(key, file, TYPES[format]);

    await this.db
      .update(resumeVersions)
      .set(format === 'pdf' ? { pdfObjectKey: key, exportStatus: 'ready' } : { docxObjectKey: key, exportStatus: 'ready' })
      .where(eq(resumeVersions.id, versionId));
    await this.db.update(resumeDocuments).set({ lastExportedAt: new Date() }).where(eq(resumeDocuments.id, resumeId));

    await this.notifications.notify({
      userId,
      jobId: ctx.job.id,
      template: 'export_ready',
      payload: { resumeId, title: row.title, format },
      idempotencyKey: `export_ready:${ctx.job.id}`,
    });
    return { resumeId, versionId, format };
  };
}
