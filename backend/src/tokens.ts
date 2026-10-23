// Injection tokens for things that are not classes. Services ask for these with
// `@Inject(...)` (written out because the dev runner does not emit the type
// metadata Nest would otherwise read from constructor parameters).

export const ENV = Symbol('ENV');

export const PG_POOL = Symbol('PG_POOL');
/** Typed queries (Drizzle) over the same pool the job store uses. */
export const DB = Symbol('DB');
export const QUEUE_REDIS = Symbol('QUEUE_REDIS');
export const SUBSCRIBER_REDIS = Symbol('SUBSCRIBER_REDIS');
export const PUBLISHER_REDIS = Symbol('PUBLISHER_REDIS');

export const JOB_STORE = Symbol('JOB_STORE');
export const JOB_QUEUE = Symbol('JOB_QUEUE');
export const JOB_EVENTS = Symbol('JOB_EVENTS');
/** Tells open progress streams that a job row changed. Best effort. */
export const NOTIFY_JOB = Symbol('NOTIFY_JOB');
export const JOB_HANDLERS = Symbol('JOB_HANDLERS');
/** How often an open stream re-reads the job, in case a pub/sub message was lost. */
export const STREAM_POLL_MS = Symbol('STREAM_POLL_MS');

export const VERIFY_TOKEN = Symbol('VERIFY_TOKEN');
/** Counts calls per key in a time window, shared across instances. */
export const RATE_LIMITER = Symbol('RATE_LIMITER');

/** Integration clients. Each throws NOT_CONFIGURED when its settings are missing. */
export const STORAGE = Symbol('STORAGE');
export const EMAIL = Symbol('EMAIL');
export const AI_ENGINE = Symbol('AI_ENGINE');
export const CLOCK = Symbol('CLOCK');
/** Encrypts provider tokens and webhook secrets at rest. */
export const SECRET_BOX = Symbol("SECRET_BOX");
/** GitHub REST access. Replaced by a fake in tests. */
export const GITHUB = Symbol("GITHUB");
/** HTTP fetch that refuses private network addresses, for portfolio links and webhooks. */
export const SAFE_FETCH = Symbol("SAFE_FETCH");

/** Calls the language and embedding models. Throws NOT_CONFIGURED when no API key is set. */
export const LLM_CLIENT = Symbol('LLM_CLIENT');
/** Records every model call (tokens, latency, status; never prompt text) in llm_calls. */
export const USAGE_SINK = Symbol('USAGE_SINK');

/** Paystack: start payments, verify them, stop subscriptions. */
export const PAYSTACK = Symbol('PAYSTACK');
