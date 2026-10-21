import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { EntitlementsService } from './entitlements.service';

/** Services every feature module uses: plan limits and the audit trail. */
@Global()
@Module({
  providers: [EntitlementsService, AuditService],
  exports: [EntitlementsService, AuditService],
})
export class CoreModule {}
