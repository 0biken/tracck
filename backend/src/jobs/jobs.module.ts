import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailSendHandler } from '../email/email.handler';
import { EmailModule } from '../email/email.module';
import { CvReviewService } from '../evidence/cv-review.service';
import { EvidenceModule } from '../evidence/evidence.module';
import { AccountDeletionHandler } from '../privacy/deletion.handler';
import { DataExportHandler } from '../privacy/export.handler';
import { OrgModule } from '../org/org.module';
import { WebhookDeliveryHandler } from '../org/webhook.handler';
import { PrivacyModule } from '../privacy/privacy.module';
import { ResumeExportHandler } from '../resumes/export.handler';
import { ResumeGenerationHandler } from '../resumes/generation.handler';
import { ResumesModule } from '../resumes/resumes.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { WeeklyDigestHandler } from '../scheduler/weekly-digest.handler';
import { CvParseHandler, SourceImportHandler } from '../sources/import.handlers';
import { SourcesModule } from '../sources/sources.module';
import { JOB_HANDLERS, STREAM_POLL_MS } from '../tokens';
import { JobStreamService } from './job-stream.service';
import { JobWorkerService } from './job-worker.service';
import { jobHandlers } from './handlers';
import { DiagnosticJobsEnabledGuard } from './diagnostic-jobs-enabled.guard';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

/** The job API (create, read, cancel, retry, stream) and the worker that runs jobs. */
@Module({
  imports: [AuthModule, SourcesModule, EvidenceModule, ResumesModule, EmailModule, PrivacyModule, SchedulerModule, OrgModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobStreamService,
    JobWorkerService,
    DiagnosticJobsEnabledGuard,
    {
      provide: JOB_HANDLERS,
      inject: [
        SourceImportHandler,
        CvParseHandler,
        CvReviewService,
        ResumeGenerationHandler,
        ResumeExportHandler,
        EmailSendHandler,
        DataExportHandler,
        AccountDeletionHandler,
        WeeklyDigestHandler,
        WebhookDeliveryHandler,
      ],
      // One handler per job type. Each feature module exports the handlers it owns.
      useFactory: (
        sourceImport: SourceImportHandler,
        cvParse: CvParseHandler,
        cvReview: CvReviewService,
        generation: ResumeGenerationHandler,
        exporter: ResumeExportHandler,
        email: EmailSendHandler,
        dataExport: DataExportHandler,
        deletion: AccountDeletionHandler,
        digest: WeeklyDigestHandler,
        webhook: WebhookDeliveryHandler,
      ) => ({
        ...jobHandlers,
        source_import: sourceImport.handle,
        source_sync: sourceImport.handle,
        cv_parse: cvParse.handle,
        cv_review: cvReview.handle,
        resume_generation: generation.handle,
        resume_export: exporter.handle,
        email_send: email.handle,
        data_export: dataExport.handle,
        account_deletion: deletion.handle,
        weekly_digest: digest.handle,
        webhook_delivery: webhook.handle,
      }),
    },
    { provide: STREAM_POLL_MS, useValue: 5_000 },
  ],
})
export class JobsModule {}
