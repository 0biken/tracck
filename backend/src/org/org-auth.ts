import { CanActivate, CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { tap } from 'rxjs';
import { ApiError, type KeyScope } from '@tracck/shared';
import type { ApiRequest } from '../common/api-request';
import { RateLimitedError } from '../common/rate-limited';
import { AuditService } from '../core/audit.service';
import type { Database } from '../db';
import type { RateLimiter } from '../connections/rate-limiter';
import { apiClients, apiKeys, apiUsageEvents } from '../db/schema';
import { DB, RATE_LIMITER } from '../tokens';
import { parseKey, secretMatches } from './api-key';

/** Who is calling, once a key has been checked. */
export interface OrgContext {
  keyId: string;
  clientId: string;
  clientName: string;
  mode: 'live' | 'test';
  scopes: string[];
  keyQuota: number | null;
  clientQuota: number;
  ip: string | null;
}

export type OrgRequest = ApiRequest & { org?: OrgContext; orgCost?: number };

const SCOPE = 'org:scope';
/** The scope a route needs. A key without it gets a 403 naming the scope. */
export const RequireScope = (scope: KeyScope) => SetMetadata(SCOPE, scope);

const NOT_SIGNED_IN = 'Send your API key as "Authorization: Bearer trk_...".';
const BAD_KEY = 'That API key is not valid.';
const touchedRecently = new Map<string, number>();

/**
 * Checks an organisation's API key on every call: that it is real, still active, within its
 * rate limit and allowed to do this. The reasons for refusing are deliberately vague about
 * which part failed, so a guess teaches nothing.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<OrgRequest & Request>();
    const response = http.getResponse<Response>();

    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', NOT_SIGNED_IN);
    const parsed = parseKey(token);
    if (!parsed) throw new ApiError(401, 'UNAUTHORIZED', BAD_KEY);

    const [row] = await this.db
      .select({ key: apiKeys, client: apiClients })
      .from(apiKeys)
      .innerJoin(apiClients, eq(apiClients.id, apiKeys.clientId))
      .where(and(eq(apiKeys.prefix, parsed.prefix), eq(apiKeys.mode, parsed.mode)));
    if (!row || !secretMatches(parsed.secret, row.key.secretHash)) throw new ApiError(401, 'UNAUTHORIZED', BAD_KEY);

    const ip = request.ip ?? null;
    const now = new Date();
    const stopped = row.key.revokedAt || (row.key.stopsAt && new Date(row.key.stopsAt) <= now) || (row.key.expiresAt && new Date(row.key.expiresAt) <= now);
    if (stopped) {
      await this.noteMisuse(row.key.id, row.client.id, ip);
      throw new ApiError(401, 'UNAUTHORIZED', 'That API key is no longer active.');
    }
    if (row.client.status !== 'active') throw new ApiError(403, 'FORBIDDEN', 'This organisation is not active. Contact Tracck.');

    request.org = {
      keyId: row.key.id,
      clientId: row.client.id,
      clientName: row.client.name,
      mode: row.key.mode,
      scopes: row.key.scopes,
      keyQuota: row.key.monthlyQuota,
      clientQuota: row.client.monthlyQuota,
      ip,
    };

    const endpoint = `${request.method} ${request.route?.path ?? request.path}`;
    const limit = await this.limiter.hit(`org:key:${row.key.id}`, row.key.rateLimitPerMin, 60);
    response.setHeader('X-RateLimit-Limit', String(row.key.rateLimitPerMin));
    response.setHeader('X-RateLimit-Remaining', String(limit.remaining));
    if (!limit.allowed) {
      await this.record(request.org, endpoint, 429, 0);
      throw new RateLimitedError(`Too many requests. Try again in ${limit.retryAfterSeconds} seconds.`, limit.retryAfterSeconds);
    }

    const needed = this.reflector.get<KeyScope | undefined>(SCOPE, context.getHandler());
    if (needed && !row.key.scopes.includes(needed)) {
      await this.record(request.org, endpoint, 403, 0);
      throw new ApiError(403, 'FORBIDDEN', `This key does not have the "${needed}" scope.`);
    }

    this.touch(row.key.id, ip);
    return true;
  }

  async record(org: OrgContext, endpoint: string, status: number, cost: number) {
    await this.db.insert(apiUsageEvents).values({ keyId: org.keyId, endpoint, status, costUnits: cost, ip: org.ip }).catch(() => {});
  }

  /** Updated at most once a minute per key, so a busy key does not turn every call into two writes. */
  private touch(keyId: string, ip: string | null) {
    const last = touchedRecently.get(keyId) ?? 0;
    if (Date.now() - last < 60_000) return;
    touchedRecently.set(keyId, Date.now());
    void this.db.update(apiKeys).set({ lastUsedAt: new Date(), lastUsedIp: ip }).where(eq(apiKeys.id, keyId)).catch(() => {});
  }

  /** A stopped key being used is worth a line in the audit log, but not one per request. */
  private async noteMisuse(keyId: string, clientId: string, ip: string | null) {
    const hit = await this.limiter.hit(`org:misuse:${keyId}`, 1, 300);
    if (hit.allowed) await this.audit.record({ eventType: 'api.unauthorized', clientId, keyId, actor: 'api', ip });
  }
}

/** Records what each call did: the route, the status it answered, and what it cost against the quota. */
@Injectable()
export class OrgUsageInterceptor implements NestInterceptor {
  constructor(@Inject(DB) private readonly db: Database) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<OrgRequest & Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const log = (status: number) => {
      const org = request.org;
      if (!org) return;
      void this.db
        .insert(apiUsageEvents)
        .values({ keyId: org.keyId, endpoint: `${request.method} ${request.route?.path ?? request.path}`, status, costUnits: status < 300 ? (request.orgCost ?? 0) : 0, ip: org.ip })
        .catch(() => {});
    };
    return next.handle().pipe(
      tap({
        next: () => log(response.statusCode),
        error: (error: unknown) => log((error as { status?: number })?.status ?? 500),
      }),
    );
  }
}
