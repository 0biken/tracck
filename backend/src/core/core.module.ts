import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JobDispatcher } from './job-dispatcher.service';
import { NotificationsService } from './notifications.service';
import { EntitlementsService } from './entitlements.service';

/** Services every feature module uses: plan limits, the audit trail, starting jobs, notices. */
@Global()
@Module({
  providers: [EntitlementsService, AuditService, JobDispatcher, NotificationsService],
  exports: [EntitlementsService, AuditService, JobDispatcher, NotificationsService],
})
export class CoreModule {}
