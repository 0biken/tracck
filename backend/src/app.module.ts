import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ConfigModule } from './config/config.module';
import { ConnectionsModule } from './connections/connections.module';
import { CoreModule } from './core/core.module';
import { HealthController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';
import { MeModule } from './me/me.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [ConfigModule, ConnectionsModule, CoreModule, JobsModule, MeModule, WaitlistModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
