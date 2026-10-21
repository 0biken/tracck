import type { INestApplication } from '@nestjs/common';
import { requestId } from './common/api-request';

/**
 * The parts of the HTTP layer that belong to the process, not to a module:
 * request IDs and CORS. Shared by `main.ts` and the tests so both run the same
 * pipeline.
 */
export function configureApp(app: INestApplication, options: { appOrigin: string }) {
  app.use(requestId);
  app.enableCors({
    origin: options.appOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'Last-Event-ID'],
    exposedHeaders: ['X-Correlation-Id'],
  });
}
