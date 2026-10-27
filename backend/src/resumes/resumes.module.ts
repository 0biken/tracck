import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SourcesModule } from '../sources/sources.module';
import { ResumeExportHandler } from './export.handler';
import { EvidenceSelector } from './evidence-selector';
import { ResumeGenerationHandler } from './generation.handler';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';

/** Job opportunities, resume generation, versions, bullet edits and exports. */
@Module({
  imports: [AuthModule, SourcesModule],
  controllers: [ResumesController],
  providers: [ResumesService, EvidenceSelector, ResumeGenerationHandler, ResumeExportHandler],
  exports: [ResumesService, ResumeGenerationHandler, ResumeExportHandler],
})
export class ResumesModule {}
