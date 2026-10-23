import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  ApiError,
  type ApiKeyView,
  type AuditEventView,
  type ClientView,
  type CreateKeyRequest,
  type CreatedKeyResponse,
  type UsageView,
} from '@tracck/shared';
import type { SecretBox } from '../common/secret-box';
import { AuditService } from '../core/audit.service';
import type { Database } from '../db';
import { apiClients, apiKeys } from '../db/schema';
import { DB, SECRET_BOX } from '../tokens';
import { generateKey, stateOf, toKeyView, type KeyRow } from './api-key';

const ROTATION_GRACE_HOURS = 24;
const DAY_MS = 86_400_000;
const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;
const ALERT_EVENTS = new Set(['key.revoked', 'api.unauthorized', 'api.expired_key_used']);

const toClient = (row: typeof apiClients.$inferSelect): ClientView => ({
  id: row.id,
  name: row.name,
  status: row.status,
  contactEmail: row.contactEmail,
  monthlyQuota: row.monthlyQuota,
  createdAt: new Date(row.createdAt).toISOString(),
});

/** What the Tracck team does for an organisation: set it up, give it keys, watch its use. */
@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SECRET_BOX) private readonly box: SecretBox,
  ) {}

  // ─── Clients ───────────────────────────────────────────────────────────────

  async clients(): Promise<ClientView[]> {
    return (await this.db.select().from(apiClients).orderBy(desc(apiClients.createdAt))).map(toClient);
  }

  async createClient(staffId: string, input: { name: string; contactEmail?: string; monthlyQuota?: number }): Promise<ClientView> {
    const [row] = await this.db
      .insert(apiClients)
      .values({ name: input.name, status: 'active', contactEmail: input.contactEmail ?? null, ...(input.monthlyQuota !== undefined && { monthlyQuota: input.monthlyQuota }) })
      .returning();
    await this.audit.record({ eventType: 'client.created', clientId: row.id, actor: staffId, metadata: { name: row.name } });
    return toClient(row);
  }

  async updateClient(staffId: string, clientId: string, input: { status?: 'active' | 'suspended'; monthlyQuota?: number }): Promise<ClientView> {
    const [row] = await this.db
      .update(apiClients)
      .set({ ...(input.status && { status: input.status }), ...(input.monthlyQuota !== undefined && { monthlyQuota: input.monthlyQuota }) })
      .where(eq(apiClients.id, clientId))
      .returning();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'We could not find that organisation.');
    await this.audit.record({ eventType: input.status ? `client.${input.status}` : 'client.updated', clientId, actor: staffId, metadata: { ...input } });
    return toClient(row);
  }

  private async client(clientId: string) {
    const [row] = await this.db.select().from(apiClients).where(eq(apiClients.id, clientId));
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'We could not find that organisation.');
    return row;
  }

  /** Sets where completed work is sent. The signing secret is shown once, here, and never again. */
  async setWebhook(staffId: string, clientId: string, url: string): Promise<{ url: string; secret: string }> {
    await this.client(clientId);
    const secret = `whsec_${randomBytes(24).toString('base64url')}`;
    await this.db.update(apiClients).set({ webhookUrl: url, webhookSecretEncrypted: this.box.encrypt(secret) }).where(eq(apiClients.id, clientId));
    await this.audit.record({ eventType: 'webhook.configured', clientId, actor: staffId, metadata: { host: new URL(url).host } });
    return { url, secret };
  }

  // ─── Keys ──────────────────────────────────────────────────────────────────

  async keys(clientId: string): Promise<ApiKeyView[]> {
    await this.client(clientId);
    const rows = await this.db.select().from(apiKeys).where(eq(apiKeys.clientId, clientId)).orderBy(desc(apiKeys.createdAt));
    return rows.map((row) => toKeyView(row as KeyRow));
  }

  async createKey(staffId: string, clientId: string, input: CreateKeyRequest, rotatedFrom?: string): Promise<CreatedKeyResponse> {
    const client = await this.client(clientId);
    if (client.status !== 'active') throw new ApiError(409, 'CONFLICT', 'This organisation is suspended. Reactivate it before creating keys.');

    const generated = generateKey(input.mode);
    const [row] = await this.db
      .insert(apiKeys)
      .values({
        clientId,
        prefix: generated.prefix,
        secretHash: generated.secretHash,
        mode: input.mode,
        label: input.label,
        scopes: input.scopes,
        rateLimitPerMin: input.rateLimitPerMin ?? 60,
        monthlyQuota: input.monthlyQuota ?? null,
        expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * DAY_MS) : null,
        rotatedFrom: rotatedFrom ?? null,
        createdBy: staffId,
      })
      .returning();
    await this.audit.record({ eventType: rotatedFrom ? 'key.rotated' : 'key.created', clientId, keyId: row.id, actor: staffId, metadata: { label: row.label, mode: row.mode, scopes: row.scopes } });
    return { key: toKeyView(row as KeyRow), secret: generated.token };
  }

  /** A new key with the same settings. The old one keeps working for a day, so the organisation can switch over. */
  async rotateKey(staffId: string, clientId: string, keyId: string): Promise<CreatedKeyResponse> {
    const [old] = await this.db.select().from(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.clientId, clientId)));
    if (!old) throw new ApiError(404, 'NOT_FOUND', 'We could not find that key.');
    if (stateOf(old as KeyRow) !== 'active') throw new ApiError(409, 'CONFLICT', 'Only a key that is in use can be rotated.');

    const created = await this.createKey(
      staffId,
      clientId,
      {
        label: old.label,
        mode: old.mode,
        scopes: old.scopes as CreateKeyRequest['scopes'],
        rateLimitPerMin: old.rateLimitPerMin,
        monthlyQuota: old.monthlyQuota,
        expiresInDays: old.expiresAt ? Math.max(1, Math.ceil((new Date(old.expiresAt).getTime() - Date.now()) / DAY_MS)) : null,
      },
      old.id,
    );
    await this.db.update(apiKeys).set({ stopsAt: new Date(Date.now() + ROTATION_GRACE_HOURS * 3_600_000) }).where(eq(apiKeys.id, old.id));
    return created;
  }

  /** Revoking takes effect on the next call. */
  async revokeKey(staffId: string, clientId: string, keyId: string): Promise<void> {
    const [row] = await this.db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.clientId, clientId), sql`${apiKeys.revokedAt} is null`))
      .returning({ id: apiKeys.id });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'We could not find an active key with that ID.');
    await this.audit.record({ eventType: 'key.revoked', clientId, keyId, actor: staffId });
  }

  // ─── Usage and audit ───────────────────────────────────────────────────────

  async usage(clientId: string, now = new Date()): Promise<UsageView> {
    const client = await this.client(clientId);
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const days = to.getUTCDate();

    const [totals] = rowsOf<{ requests: number; ok: number; resumes: number; limited: number }>(
      await this.db.execute(sql`
        select count(*)::int as requests,
               count(*) filter (where e.status < 400)::int as ok,
               coalesce(sum(e.cost_units), 0)::int as resumes,
               count(*) filter (where e.status = 429)::int as limited
          from public.api_usage_events e join public.api_keys k on k.id = e.key_id
         where k.client_id = ${clientId} and e.at >= ${from.toISOString()}`),
    );
    const perDayRows = rowsOf<{ day: number; n: number }>(
      await this.db.execute(sql`
        select extract(day from e.at)::int as day, coalesce(sum(e.cost_units), 0)::int as n
          from public.api_usage_events e join public.api_keys k on k.id = e.key_id
         where k.client_id = ${clientId} and e.at >= ${from.toISOString()} group by 1`),
    );
    const perDay = Array.from({ length: days }, (_, index) => perDayRows.find((row) => row.day === index + 1)?.n ?? 0);

    const [people] = rowsOf<{ consented: number; revoked: number }>(
      await this.db.execute(sql`
        select count(distinct user_id) filter (where revoked_at is null)::int as consented,
               count(*) filter (where revoked_at >= ${from.toISOString()})::int as revoked
          from public.consents where client_id = ${clientId}`),
    );

    const keyUse = rowsOf<{ prefix: string; mode: string; quota: number | null; used: number; limited: number }>(
      await this.db.execute(sql`
        select k.prefix, k.mode, k.monthly_quota as quota,
               coalesce(sum(e.cost_units) filter (where e.at >= ${from.toISOString()}), 0)::int as used,
               count(*) filter (where e.status = 429 and e.at >= ${new Date(now.getTime() - DAY_MS).toISOString()})::int as limited
          from public.api_keys k left join public.api_usage_events e on e.key_id = k.id
         where k.client_id = ${clientId} and k.revoked_at is null group by k.id`),
    );
    const alerts: UsageView['alerts'] = [];
    for (const key of keyUse) {
      const name = `trk_${key.mode}_${key.prefix}…`;
      if (key.quota && key.used >= key.quota * 0.8) alerts.push({ keyPrefix: name, message: `Has used ${Math.round((key.used / key.quota) * 100)}% of its monthly quota.`, at: now.toISOString() });
      if (key.limited > 0) alerts.push({ keyPrefix: name, message: `Was rate limited ${key.limited} ${key.limited === 1 ? 'time' : 'times'} in the last day.`, at: now.toISOString() });
    }

    return {
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      client: toClient(client),
      resumesGenerated: totals.resumes,
      quota: client.monthlyQuota,
      apiRequests: totals.requests,
      successRate: totals.requests === 0 ? 100 : Math.round((totals.ok / totals.requests) * 1000) / 10,
      studentsConsented: people.consented,
      consentsRevoked: people.revoked,
      rateLimited: totals.limited,
      perDay,
      quotaUsedPercent: Math.round((totals.resumes / Math.max(1, client.monthlyQuota)) * 100),
      monthElapsedPercent: Math.round((now.getUTCDate() / days) * 100),
      alerts,
    };
  }

  async auditLog(clientId: string, keyId?: string): Promise<AuditEventView[]> {
    await this.client(clientId);
    const rows = rowsOf<{ at: string; event: string; prefix: string | null; mode: string | null; actor: string | null; name: string | null; ip: string | null }>(
      await this.db.execute(sql`
        select a.created_at as at, a.event_type as event, k.prefix, k.mode, a.actor, p.display_name as name, a.ip
          from public.audit_events a
          left join public.api_keys k on k.id = a.key_id
          left join public.profiles p on p.id::text = a.actor
         where a.client_id = ${clientId} and (${keyId ?? null}::uuid is null or a.key_id = ${keyId ?? null}::uuid)
         order by a.created_at desc limit 200`),
    );
    return rows.map((row) => ({
      at: new Date(row.at).toISOString(),
      event: row.event,
      keyPrefix: row.prefix ? `trk_${row.mode}_${row.prefix}…` : null,
      by: row.name ?? (row.actor === 'api' ? 'API' : row.actor ? 'Tracck team' : null),
      ip: row.ip,
      alert: ALERT_EVENTS.has(row.event),
    }));
  }

  /** The audit log as a spreadsheet, for an organisation's own records. */
  async auditCsv(clientId: string, keyId?: string): Promise<string> {
    const cell = (value: string | null) => `"${(value ?? '').replaceAll('"', '""')}"`;
    const events = await this.auditLog(clientId, keyId);
    return ['at,event,key,by,ip', ...events.map((e) => [e.at, e.event, e.keyPrefix, e.by, e.ip].map(cell).join(','))].join('\n');
  }
}
