import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { JobError } from '@tracck/shared';
import { SecretBox } from '../common/secret-box';
import { UnsafeUrlError, type SafeFetch } from '../common/safe-fetch';
import type { Database } from '../db';
import type { JobHandler } from '../jobs/runner';
import { DB, SAFE_FETCH, SECRET_BOX } from '../tokens';

const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;

/** The signature receivers check: a timestamp and an HMAC of "timestamp.body", so an old delivery cannot be replayed. */
export function signWebhook(secret: string, timestamp: number, body: string) {
  return `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

/** Tells an organisation how a resume it asked for turned out. Retried with backoff; the result stays available by polling. */
@Injectable()
export class WebhookDeliveryHandler {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(SAFE_FETCH) private readonly safeFetch: SafeFetch,
    @Inject(SECRET_BOX) private readonly box: SecretBox,
  ) {}

  handle: JobHandler = async (ctx) => {
    const { clientId, event, jobId, resumeId } = ctx.job.inputRef as { clientId: string; event: string; jobId: string; resumeId: string };

    const [client] = rowsOf<{ url: string | null; secret: string | null }>(
      await this.db.execute(sql`select webhook_url as url, webhook_secret_encrypted as secret from public.api_clients where id = ${clientId}`),
    );
    if (!client?.url || !client.secret) return { delivered: false, reason: 'no_webhook' };

    const [consent] = rowsOf<{ ref: string | null }>(
      await this.db.execute(sql`
        select external_ref as ref from public.consent_requests
         where client_id = ${clientId} and user_id = ${ctx.job.userId} and status = 'granted' order by decided_at desc limit 1`),
    );

    const body = JSON.stringify({
      id: `evt_${ctx.job.id}`,
      type: event,
      createdAt: new Date().toISOString(),
      data: { jobId, resumeId, status: event === 'resume.completed' ? 'succeeded' : 'failed', externalRef: consent?.ref ?? null },
    });
    const timestamp = Math.floor(Date.now() / 1000);

    let status: number;
    try {
      const response = await this.safeFetch.request(client.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Tracck-Event': event, 'Tracck-Signature': signWebhook(this.box.decrypt(client.secret), timestamp, body) },
        body,
        timeoutMs: 10_000,
        maxBytes: 64 * 1024,
        maxRedirects: 0,
      });
      status = response.status;
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw new JobError('permanent', 'WEBHOOK_UNSAFE', 'The webhook address is not allowed.');
      throw new JobError('retryable', 'WEBHOOK_UNREACHABLE', 'The webhook address could not be reached.');
    }

    if (status >= 200 && status < 300) return { delivered: true };
    // A receiver that is down or busy is tried again; one that refuses us is not.
    if (status >= 500 || status === 408 || status === 429) throw new JobError('retryable', 'WEBHOOK_FAILED', `The webhook answered ${status}.`);
    throw new JobError('permanent', 'WEBHOOK_REJECTED', `The webhook answered ${status}.`);
  };
}
