// Injection tokens for things that are not classes. Services ask for these with
// `@Inject(...)` (written out because the dev runner does not emit the type
// metadata Nest would otherwise read from constructor parameters).

export const ENV = Symbol('ENV');

export const PG_POOL = Symbol('PG_POOL');
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
