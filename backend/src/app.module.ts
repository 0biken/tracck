import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ConfigModule } from './config/config.module';
import { ConnectionsModule } from './connections/connections.module';
import { HealthController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [ConfigModule, ConnectionsModule, JobsModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
