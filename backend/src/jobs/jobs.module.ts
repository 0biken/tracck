import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JOB_HANDLERS, STREAM_POLL_MS } from '../tokens';
import { JobStreamService } from './job-stream.service';
import { JobWorkerService } from './job-worker.service';
import { jobHandlers } from './handlers';
import { DiagnosticJobsEnabledGuard } from './diagnostic-jobs-enabled.guard';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

/** The job API (create, read, cancel, retry, stream) and the worker that runs jobs. */
@Module({
  imports: [AuthModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobStreamService,
    JobWorkerService,
    DiagnosticJobsEnabledGuard,
    { provide: JOB_HANDLERS, useValue: jobHandlers },
    { provide: STREAM_POLL_MS, useValue: 5_000 },
  ],
})
export class JobsModule {}
