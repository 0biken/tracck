import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { ApiError, KEY_SCOPES, SCOPE_LABELS, type ConsentRequestView, type KeyScope } from '@tracck/shared';
import { AuditService } from '../core/audit.service';
import type { Database } from '../db';
import { apiClients, consentRequests, consents } from '../db/schema';
import { DB } from '../tokens';

const REQUEST_DAYS = 7;
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const isScope = (value: string): value is KeyScope => (KEY_SCOPES as readonly string[]).includes(value);

/** An organisation asks; the person decides on a Tracck page. Nothing is shared until they say yes. */
@Injectable()
export class ConsentService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Used by the organisation API: makes a link to send to a person. */
  async createRequest(clientId: string, keyId: string, scopes: KeyScope[], externalRef: string | null) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + REQUEST_DAYS * 86_400_000);
    await this.db.insert(consentRequests).values({ clientId, tokenHash: hashToken(token), scopes, externalRef, expiresAt });
    await this.audit.record({ eventType: 'consent.requested', clientId, keyId, actor: 'api', metadata: { scopes } });
    return { token, expiresAt };
  }

  private async find(token: string) {
    const [row] = await this.db
      .select({ request: consentRequests, orgName: apiClients.name, orgStatus: apiClients.status })
      .from(consentRequests)
      .innerJoin(apiClients, eq(apiClients.id, consentRequests.clientId))
      .where(eq(consentRequests.tokenHash, hashToken(token)));
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'This link is not valid. Ask the organisation for a new one.');
    return row;
  }

  private statusOf(row: { request: typeof consentRequests.$inferSelect }): ConsentRequestView['status'] {
    return row.request.status === 'pending' && new Date(row.request.expiresAt) <= new Date() ? 'expired' : row.request.status;
  }

  /** What the page shows. The token is the proof of who it is for, so no sign-in is needed to read it. */
  async view(token: string): Promise<ConsentRequestView> {
    const row = await this.find(token);
    return {
      orgName: row.orgName,
      scopes: row.request.scopes.filter(isScope).map((id) => ({ id, label: SCOPE_LABELS[id] })),
      status: this.statusOf(row),
      requestedAt: new Date(row.request.createdAt).toISOString(),
      expiresAt: new Date(row.request.expiresAt).toISOString(),
    };
  }

  async grant(userId: string, token: string, scopes: KeyScope[]): Promise<void> {
    const row = await this.find(token);
    if (row.orgStatus !== 'active') throw new ApiError(409, 'CONFLICT', 'This organisation can no longer ask for access.');
    if (this.statusOf(row) !== 'pending') throw new ApiError(409, 'CONFLICT', 'This request has already been answered or has expired.');

    const asked = row.request.scopes;
    const chosen = [...new Set(scopes)];
    if (chosen.length === 0 || chosen.some((scope) => !asked.includes(scope))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Choose from what the organisation asked for.');
    }

    await this.db.transaction(async (tx) => {
      // Answering is a single move from pending, so two taps cannot both succeed.
      const [claimed] = await tx
        .update(consentRequests)
        .set({ status: 'granted', userId, decidedAt: new Date() })
        .where(and(eq(consentRequests.id, row.request.id), eq(consentRequests.status, 'pending')))
        .returning({ id: consentRequests.id });
      if (!claimed) throw new ApiError(409, 'CONFLICT', 'This request has already been answered or has expired.');
      await tx.insert(consents).values(chosen.map((scope) => ({ userId, clientId: row.request.clientId, scope }))).onConflictDoNothing();
    });
    await this.audit.record({ eventType: 'consent.granted', clientId: row.request.clientId, userId, actor: userId, metadata: { scopes: chosen } });
  }

  async deny(userId: string, token: string): Promise<void> {
    const row = await this.find(token);
    if (this.statusOf(row) !== 'pending') throw new ApiError(409, 'CONFLICT', 'This request has already been answered or has expired.');
    await this.db
      .update(consentRequests)
      .set({ status: 'denied', userId, decidedAt: new Date() })
      .where(and(eq(consentRequests.id, row.request.id), eq(consentRequests.status, 'pending')));
    await this.audit.record({ eventType: 'consent.denied', clientId: row.request.clientId, userId, actor: userId });
  }

  /** Whether the organisation may use this scope for this person right now. */
  async allows(clientId: string, userId: string, scope: KeyScope): Promise<boolean> {
    const result = (await this.db.execute(sql`
      select 1 from public.consents where client_id = ${clientId} and user_id = ${userId} and scope = ${scope} and revoked_at is null limit 1`)) as unknown as { rows: unknown[] };
    return result.rows.length > 0;
  }
}
