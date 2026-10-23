import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ResumesModule } from '../resumes/resumes.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';
import { OrgApiController } from './org-api.controller';
import { OrgApiService } from './org-api.service';
import { ApiKeyGuard, OrgUsageInterceptor } from './org-auth';
import { StaffGuard } from './staff.guard';
import { WebhookDeliveryHandler } from './webhook.handler';

/** Organisations: the staff console, people's consent, and the API organisations call with a key. */
@Module({
  imports: [AuthModule, ResumesModule],
  controllers: [AdminController, ConsentController, OrgApiController],
  providers: [AdminService, ConsentService, OrgApiService, ApiKeyGuard, OrgUsageInterceptor, StaffGuard, WebhookDeliveryHandler],
  exports: [WebhookDeliveryHandler],
})
export class OrgModule {}
