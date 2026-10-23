import { Module } from '@nestjs/common';
import type { ApiEnv } from '../config/env';
import { AuthModule } from '../auth/auth.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { ENV, GITHUB } from '../tokens';
import { HttpGithubClient, UnconfiguredGithub } from './github.client';
import { CvParseHandler, SourceImportHandler } from './import.handlers';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

/** Where a person's evidence comes from: GitHub, a CV, LinkedIn, a portfolio, pasted text. */
@Module({
  imports: [AuthModule, EvidenceModule],
  controllers: [SourcesController],
  providers: [
    SourcesService,
    SourceImportHandler,
    CvParseHandler,
    {
      provide: GITHUB,
      inject: [ENV],
      useFactory: (env: ApiEnv) =>
        env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.API_PUBLIC_URL
          ? new HttpGithubClient(
              env.GITHUB_CLIENT_ID,
              env.GITHUB_CLIENT_SECRET,
              `${env.API_PUBLIC_URL.replace(/\/$/, '')}/v1/sources/github/callback`,
            )
          : new UnconfiguredGithub(),
    },
  ],
  exports: [SourceImportHandler, CvParseHandler],
})
export class SourcesModule {}
