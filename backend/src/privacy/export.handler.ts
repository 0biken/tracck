import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { strToU8, zipSync } from 'fflate';
import { JobError } from '@tracck/shared';
import { NotificationsService } from '../core/notifications.service';
import { JobDispatcher } from '../core/job-dispatcher.service';
import type { Database } from '../db';
import type { EmailSender } from '../email/email';
import type { JobHandler } from '../jobs/runner';
import type { ObjectStorage } from '../storage/storage';
import { DB, EMAIL, STORAGE } from '../tokens';

const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;
const MAX_FILE_BYTES = 6 * 1024 * 1024;

export const exportKey = (userId: string, at: Date) => `users/${userId}/exports/${at.toISOString().replace(/[:.]/g, '-')}.zip`;

/**
 * Everything Tracck holds about a person, in files they can open: their record, resumes,
 * settings and the files they uploaded. Secrets (provider tokens) and other people's data
 * are never in it.
 */
@Injectable()
export class DataExportHandler {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(JobDispatcher) private readonly jobs: JobDispatcher,
    @Inject(EMAIL) private readonly email: EmailSender,
  ) {}

  handle: JobHandler = async (ctx) => {
    const userId = ctx.job.userId;
    await ctx.setStep('normalize', 20);

    const table = async (name: string, query: ReturnType<typeof sql>) => [`${name}.json`, strToU8(JSON.stringify(rowsOf(await this.db.execute(query)), null, 2))] as const;

    const files: Record<string, Uint8Array> = Object.fromEntries([
      await table('profile', sql`select display_name, headline, location, summary, career_level, preferred_roles, primary_role, plan, preferences_json as preferences, student_email, created_at from public.profiles where id = ${userId}`),
      await table('sources', sql`select provider, display_handle, status, last_sync_at, created_at from public.source_connections where user_id = ${userId} and revoked_at is null`),
      await table('source-items', sql`select source_type, title, canonical_url, body_text, source_created_at, imported_at from public.source_items where user_id = ${userId} and deletion_status = 'active'`),
      await table('evidence', sql`select title, claim_text as text, original_text as original, skills, project_key as project, source_provider as source, source_where as "where", valid_from, valid_to, pinned, excluded, user_edited as edited, created_at from public.candidate_evidence where user_id = ${userId} order by created_at`),
      await table('target-jobs', sql`select title, company, job_url, job_description_text as description, created_at from public.target_opportunities where user_id = ${userId}`),
      await table('resumes', sql`
        select d.id, d.title, d.company, d.length, d.status, d.created_at,
               (select coalesce(jsonb_agg(jsonb_build_object('version', v.version_number, 'createdBy', v.created_by, 'createdAt', v.created_at, 'content', v.content_json) order by v.version_number), '[]'::jsonb)
                  from public.resume_versions v where v.resume_document_id = d.id) as versions
          from public.resume_documents d where d.user_id = ${userId} order by d.created_at`),
      await table('cv-reviews', sql`select role_family, result_json as result, created_at from public.cv_reviews where user_id = ${userId}`),
      await table('notifications', sql`select template, payload_json as payload, created_at from public.notifications where user_id = ${userId} and channel = 'in_app'`),
      await table('consents', sql`select client_id, scope, granted_at, revoked_at from public.consents where user_id = ${userId}`),
      await table('policy-consents', sql`select purpose, text_version, granted_at from public.user_policy_consents where user_id = ${userId}`),
      await table('payments', sql`select provider_reference as reference, amount_minor::text as amount_kobo, currency, status, paid_at from public.payments where user_id = ${userId}`),
    ]);

    // The files the person uploaded, as they sent them.
    await ctx.setStep('download_source', 55);
    const uploads = rowsOf<{ key: string; title: string | null }>(
      await this.db.execute(sql`select raw_object_key as key, title from public.source_items where user_id = ${userId} and raw_object_key is not null`),
    );
    for (const [index, upload] of uploads.entries()) {
      try {
        const body = await this.storage.get(upload.key);
        if (body.length <= MAX_FILE_BYTES) files[`uploads/${index + 1}-${(upload.title ?? 'file').replace(/[^\w.-]+/g, '_')}`] = new Uint8Array(body);
      } catch {
        // A file that is already gone, or storage that is not set up, is left out rather than failing the export.
      }
    }

    files['README.txt'] = strToU8(
      'This is a copy of the data Tracck holds about you.\n\nEach .json file is one kind of data. "uploads" holds the files you uploaded.\nSecurity tokens and other people\'s data are not included.\n',
    );

    await ctx.setStep('export', 85);
    const key = exportKey(userId, new Date());
    try {
      await this.storage.put(key, Buffer.from(zipSync(files, { level: 6 })), 'application/zip');
    } catch {
      throw new JobError('retryable', 'EXPORT_STORAGE_FAILED', 'We could not save your export yet. We will try again.');
    }

    await this.notifications.notify({ userId, jobId: ctx.job.id, template: 'data_export_ready', payload: {}, idempotencyKey: `data_export:${ctx.job.id}` });
    if (this.email.configured) {
      await this.jobs.dispatch({ userId, jobType: 'email_send', idempotencyKey: `email:data_export:${ctx.job.id}`, input: { template: 'data_export_ready', data: {} } }).catch(() => {});
    }
    return { key };
  };
}
