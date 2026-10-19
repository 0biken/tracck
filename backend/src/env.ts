import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  /** Only for projects still on the legacy shared JWT secret. Leave unset to verify with the project's public keys. */
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  /** The frontend origin allowed to call this API. */
  APP_ORIGIN: z.url(),
  ENABLE_DIAGNOSTIC_JOBS: z.enum(['true', 'false']).default('false'),
});

export type ApiEnv = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Missing or invalid environment variables: ${names}. See .env.example.`);
  }
  return parsed.data;
}
