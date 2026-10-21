import { Inject, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { isSettled, toJobView, type JobRecord, type JobStore } from '@tracck/shared';
import type { ApiRequest } from '../common/api-request';
import type { JobEvents } from '../connections/job-events';
import { JOB_EVENTS, JOB_STORE, STREAM_POLL_MS } from '../tokens';

/**
 * Server-Sent Events for one job. Each event reports persisted state and carries
 * the job's version as its ID, so a reconnecting client can send Last-Event-ID
 * and skip what it has already seen. GET /v1/jobs/:jobId stays the source of truth.
 */
@Injectable()
export class JobStreamService {
  constructor(
    @Inject(JOB_STORE) private readonly store: JobStore,
    @Inject(JOB_EVENTS) private readonly events: JobEvents,
    @Inject(STREAM_POLL_MS) private readonly pollMs: number,
  ) {}

  open(request: ApiRequest, response: Response, job: JobRecord, userId: string) {
    // Headers already set (CORS, correlation ID) are kept by writeHead.
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let lastVersion = Number(request.headers['last-event-id']) || 0;
    let closed = false;
    let pending: Promise<void> = Promise.resolve();

    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(poll);
      clearInterval(keepAlive);
      unsubscribe();
      response.end();
    };

    const emit = (current: JobRecord) => {
      if (current.version > lastVersion) {
        lastVersion = current.version;
        response.write(`id: ${current.version}\nevent: job\ndata: ${JSON.stringify(toJobView(current))}\n\n`);
      }
      if (isSettled(current.status)) close();
    };

    // Reads are chained so two signals close together cannot write out of order.
    const refresh = () => {
      pending = pending
        .then(async () => {
          if (closed) return;
          const current = await this.store.getForUser(job.id, userId);
          if (current) emit(current);
          else close();
        })
        .catch(() => close());
    };

    const unsubscribe = this.events.subscribe(job.id, refresh);
    const poll = setInterval(refresh, this.pollMs);
    const keepAlive = setInterval(() => response.write(': keep-alive\n\n'), 20_000);
    response.on('close', close);

    emit(job);
  }
}
