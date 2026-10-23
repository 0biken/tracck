import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AiModule } from './ai/ai.module';
import { BillingModule } from './billing/billing.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ConfigModule } from './config/config.module';
import { ConnectionsModule } from './connections/connections.module';
import { CoreModule } from './core/core.module';
import { EmailModule } from './email/email.module';
import { HealthController } from './health/health.controller';
import { RolesController } from './roles/roles.controller';
import { JobsModule } from './jobs/jobs.module';
import { OrgModule } from './org/org.module';
import { MeModule } from './me/me.module';
import { SourcesModule } from './sources/sources.module';
import { StorageModule } from './storage/storage.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [
    ConfigModule,
    ConnectionsModule,
    StorageModule,
    EmailModule,
    AiModule,
    CoreModule,
    JobsModule,
    MeModule,
    SourcesModule,
    BillingModule,
    OrgModule,
    WaitlistModule,
  ],
  controllers: [HealthController, RolesController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
