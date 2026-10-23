import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { SchedulerService } from './scheduler.service';
import { WeeklyDigestHandler } from './weekly-digest.handler';

/** Work that runs on a clock: daily refresh, weekly digest, cleanup. */
@Module({
  imports: [BillingModule],
  providers: [SchedulerService, WeeklyDigestHandler],
  exports: [SchedulerService, WeeklyDigestHandler],
})
export class SchedulerModule {}
