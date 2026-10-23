import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CvReviewService } from './cv-review.service';
import { DuplicateDetector } from './duplicate-detector.service';
import { EvidenceController } from './evidence.controller';
import { EvidenceIngestService } from './evidence-ingest.service';
import { EvidenceService } from './evidence.service';
import { GraphService } from './graph.service';

/** The person's evidence: reading sources into entries, the library, the graph, and CV feedback. */
@Module({
  imports: [AuthModule],
  controllers: [EvidenceController],
  providers: [EvidenceIngestService, EvidenceService, GraphService, CvReviewService, DuplicateDetector],
  exports: [EvidenceIngestService, CvReviewService],
})
export class EvidenceModule {}
