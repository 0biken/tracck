import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { SourceProvider } from '@tracck/shared';
import type { AiEngine, SourceDocument } from '../ai/ai-engine';
import type { Database } from '../db';
import { candidateEvidence, evidenceSources } from '../db/schema';
import { AI_ENGINE, DB } from '../tokens';
import { DuplicateDetector } from './duplicate-detector.service';

export interface IngestItem {
  sourceItemId: string;
  document: SourceDocument;
}

const hashOf = (userId: string, claim: string) =>
  createHash('sha256').update(`${userId}\n${claim.trim().toLowerCase()}`).digest('hex');

/**
 * Turns source material into the person's evidence. Every entry keeps the link to
 * the source item it came from, and the wording it was first made with, so the
 * Evidence library can always show where a claim came from.
 */
@Injectable()
export class EvidenceIngestService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AI_ENGINE) private readonly ai: AiEngine,
    @Inject(DuplicateDetector) private readonly duplicates: DuplicateDetector,
  ) {}

  /** Reading the same source again never duplicates an entry: identical wording is linked, not added. */
  async ingest(
    userId: string,
    connection: { id: string; provider: SourceProvider },
    items: IngestItem[],
  ): Promise<{ created: number; total: number }> {
    let created = 0;
    let total = 0;

    for (const item of items) {
      const extracted = await this.ai.extractEvidence(item.document);
      await this.db.transaction(async (tx) => {
        for (const entry of extracted) {
          total += 1;
          const contentHash = hashOf(userId, entry.claimText);

          const [existing] = await tx
            .select({ id: candidateEvidence.id })
            .from(candidateEvidence)
            .where(and(eq(candidateEvidence.userId, userId), eq(candidateEvidence.contentHash, contentHash)))
            .limit(1);

          let evidenceId = existing?.id;
          if (!evidenceId) {
            const [row] = await tx
              .insert(candidateEvidence)
              .values({
                userId,
                evidenceType: entry.evidenceType,
                claimText: entry.claimText,
                title: entry.title,
                originalText: entry.claimText,
                skills: entry.skills,
                topics: entry.topics ?? [],
                projectKey: entry.projectKey,
                sourceProvider: connection.provider,
                sourceWhere: entry.where,
                validFrom: entry.validFrom ? entry.validFrom.toISOString().slice(0, 10) : null,
                contentHash,
              })
              .returning({ id: candidateEvidence.id });
            evidenceId = row.id;
            created += 1;
          }

          await tx
            .insert(evidenceSources)
            .values({ evidenceId, sourceItemId: item.sourceItemId, supportType: 'supports', supportExcerpt: entry.claimText.slice(0, 280) })
            .onConflictDoNothing();
        }
      });
    }

    if (created > 0) await this.duplicates.detect(userId);
    return { created, total };
  }
}
