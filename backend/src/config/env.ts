import { z } from 'zod';

/** A variable that may be left blank in `.env`: blank counts as not set. */
const optional = <T extends z.ZodType>(type: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), type.optional());

const schema = z.object({
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  /** Only for projects still on the legacy shared JWT secret. Leave unset to verify with the project's public keys. */
  SUPABASE_JWT_SECRET: optional(z.string().min(1)),
  /** The frontend origin allowed to call this API. */
  APP_ORIGIN: z.url(),
  ENABLE_DIAGNOSTIC_JOBS: z.enum(['true', 'false']).default('false'),
  /** Run background jobs in this process. Set to false for an API-only instance. */
  RUN_JOB_WORKER: z.enum(['true', 'false']).default('true'),
  /** How many background jobs this process runs at once. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),
  /** How often to recover jobs that lost their queue entry or went silent. */
  RECONCILE_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(30),

  // ─── Integrations. Each is optional: a feature whose settings are missing answers
  // 503 NOT_CONFIGURED instead of failing, so the rest of the API keeps working.

  /** The public address of this API, for links other services call back (GitHub, Paystack). */
  API_PUBLIC_URL: optional(z.url()),
  /** Supabase Storage (CV uploads, exports) and account deletion. Server only. */
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(1)),
  STORAGE_BUCKET: z.string().min(1).default('tracck-private'),
  /** 32 random bytes, base64. Encrypts provider tokens and webhook secrets. */
  TOKEN_ENCRYPTION_KEY: optional(z.string().min(1)),
  GITHUB_CLIENT_ID: optional(z.string().min(1)),
  GITHUB_CLIENT_SECRET: optional(z.string().min(1)),
  PAYSTACK_SECRET_KEY: optional(z.string().min(1)),
  /** Paystack plan codes (PLN_...) for the two monthly prices. */
  PAYSTACK_PRO_PLAN_CODE: optional(z.string().min(1)),
  PAYSTACK_STUDENT_PLAN_CODE: optional(z.string().min(1)),
  RESEND_API_KEY: optional(z.string().min(1)),
  /** For example: Tracck <hello@tracck.app> */
  EMAIL_FROM: optional(z.string().min(1)),
  /** Comma-separated Supabase user IDs allowed to use the staff console. */
  STAFF_USER_IDS: optional(z.string()),
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
