import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { AccountDeletionHandler } from './deletion.handler';
import { DataExportHandler } from './export.handler';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

/** Export a copy of your data, or delete the account. */
@Module({
  imports: [AuthModule, BillingModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, DataExportHandler, AccountDeletionHandler],
  exports: [DataExportHandler, AccountDeletionHandler],
})
export class PrivacyModule {}
