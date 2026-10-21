import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** The request as the API sees it: with an ID, and the user once they are signed in. */
export type ApiRequest = Request & { id: string; userId?: string };

/**
 * Gives every request an ID. It doubles as the correlation ID in error envelopes
 * and job rows, and comes back to the caller in `X-Correlation-Id`.
 */
export function requestId(request: Request, response: Response, next: NextFunction) {
  const id = randomUUID();
  (request as ApiRequest).id = id;
  response.setHeader('X-Correlation-Id', id);
  next();
}
