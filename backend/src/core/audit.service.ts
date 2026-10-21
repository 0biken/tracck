import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../db';
import { auditEvents } from '../db/schema';
import { DB } from '../tokens';

export interface AuditInput {
  eventType: string;
  userId?: string | null;
  clientId?: string | null;
  keyId?: string | null;
  subjectType?: string;
  subjectId?: string;
  /** A staff member's ID, a user ID, or "api". */
  actor?: string;
  ip?: string | null;
  correlationId?: string;
  /** Never document contents. */
  metadata?: Record<string, unknown>;
}

/** Records security-relevant actions. A failure to record never fails the request. */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(input: AuditInput): Promise<void> {
    try {
      await this.db.insert(auditEvents).values({
        eventType: input.eventType,
        userId: input.userId ?? null,
        clientId: input.clientId ?? null,
        keyId: input.keyId ?? null,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        actor: input.actor,
        ip: input.ip ?? null,
        correlationId: input.correlationId,
        metadataJson: input.metadata ?? {},
      });
    } catch {
      // Auditing is best effort; the action it describes has already happened.
    }
  }
}
