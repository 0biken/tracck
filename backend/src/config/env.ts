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
  RESEND_API_KEY: optional(z.string().min(1)),
  /** For example: Tracck <hello@tracck.app> */
  EMAIL_FROM: optional(z.string().min(1)),
  // ─── AI engine. Without GEMINI_API_KEY the placeholder engine is used.

  GEMINI_API_KEY: optional(z.string().min(1)),
  /** Writes and revises the resume. */
  AI_WRITER_MODEL: z.string().min(1).default('gemini-3.8-flash'),
  /** Reviews the draft. Set to a different model than the writer for an independent check. */
  AI_CRITIC_MODEL: z.string().min(1).default('gemini-3.8-flash'),
  /** Reads sources and job descriptions into structured data. A small, cheap model is enough. */
  AI_EXTRACT_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  AI_EMBEDDING_MODEL: z.string().min(1).default('gemini-embedding-001'),
  /** Must match the halfvec size in the database. */
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(128).max(3072).default(1536),
  /** Extended thinking for the writer. "off" sends no thinking setting; models that cannot think ignore it. */
  AI_WRITER_THINKING: z.enum(['off', 'minimal', 'low', 'medium', 'high']).default('off'),
  AI_CRITIC_THINKING: z.enum(['off', 'minimal', 'low', 'medium', 'high']).default('low'),
  /** How many times the critic may send the draft back to the writer. 0 skips the loop. */
  AI_MAX_REVISIONS: z.coerce.number().int().min(0).max(4).default(2),
  /** Entries given to the writer after retrieval. */
  AI_EVIDENCE_LIMIT: z.coerce.number().int().min(5).max(120).default(40),
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
