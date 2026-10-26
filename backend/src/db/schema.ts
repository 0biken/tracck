// The database schema. Migrations are generated from this file with drizzle-kit
// (`pnpm db:generate`) and applied with `pnpm db:migrate`; never edit a generated
// migration. What a schema cannot express (extensions, triggers, grants) lives in
// the custom migrations next to them.
//
// Row level security: every table has it on. A signed-in browser may read its own
// rows through the policies below and can write nothing; tables with no policy are
// reachable only by the API's server-only database role.

import { getTableColumns, getTableName, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  halfvec,
  index,
  integer,
  jsonb,
  numeric,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
  type PgTable,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole, authUsers } from 'drizzle-orm/supabase';
import { JOB_STATUSES, JOB_STEPS, JOB_TYPES } from '@tracck/shared';

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => tstz('created_at').notNull().defaultNow();
const updatedAt = () => tstz('updated_at').notNull().defaultNow();

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

/**
 * A CHECK for every column declared with `enum`, so the database refuses what the types forbid.
 * The columns an extra-config callback receives do not carry their enum values, so they are
 * read from the table the columns belong to.
 */
const enumChecks = (columns: Record<string, AnyPgColumn>) => {
  const table = Object.values(columns)[0].table as PgTable;
  return Object.values(getTableColumns(table)).flatMap((column) =>
    column.enumValues?.length
      ? [
          check(
            `${getTableName(table)}_${column.name}_check`,
            sql`${column} in (${sql.raw(column.enumValues.map((value) => `'${value}'`).join(', '))})`,
          ),
        ]
      : [],
  );
};

/** A signed-in browser may read the rows whose owner column is its own user ID. */
const ownRows = (owner: AnyPgColumn) =>
  pgPolicy(`${getTableName(owner.table)}_select_own`, {
    for: 'select',
    to: authenticatedRole,
    using: sql`(select auth.uid()) = ${owner}`,
  });

// ─── Profiles ────────────────────────────────────────────────────────────────

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    headline: text('headline'),
    location: text('location'),
    phone: text('phone'),
    address: text('address'),
    dateOfBirth: text('date_of_birth'),
    nationality: text('nationality'),
    summary: text('summary'),
    careerLevel: text('career_level'),
    preferredRoles: text('preferred_roles').array().notNull().default(sql`'{}'`),
    preferencesJson: jsonb('preferences_json').$type<Record<string, unknown>>().notNull().default({}),
    primaryRole: text('primary_role'),
    plan: text('plan', { enum: ['free', 'pro'] }).notNull().default('free'),
    deletedAt: tstz('deleted_at'),
    onboardingCompletedAt: tstz('onboarding_completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.id),
  ],
);

// ─── Sources and evidence ────────────────────────────────────────────────────

export const sourceConnections = pgTable(
  'source_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id'),
    displayHandle: text('display_handle'),
    status: text('status', {
      enum: ['not_connected', 'connected', 'sync_queued', 'syncing', 'synced', 'partial', 'needs_reauth', 'error'],
    })
      .notNull()
      .default('connected'),
    grantedScopes: text('granted_scopes').array().notNull().default(sql`'{}'`),
    consentVersion: text('consent_version').notNull(),
    connectedAt: tstz('connected_at').notNull().defaultNow(),
    lastSyncAt: tstz('last_sync_at'),
    lastErrorCode: text('last_error_code'),
    revokedAt: tstz('revoked_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    
    uniqueIndex('source_connections_account_unique')
      .on(t.userId, t.provider, t.providerAccountId)
      .where(sql`${t.revokedAt} is null`),
    index('source_connections_user_idx').on(t.userId),
  ],
);

/** Encrypted provider tokens. Never exposed to browser roles. */
export const sourceConnectionSecrets = pgTable(
  'source_connection_secrets',
  {
    connectionId: uuid('connection_id')
      .primaryKey()
      .references(() => sourceConnections.id, { onDelete: 'cascade' }),
    accessTokenEncrypted: text('access_token_encrypted'),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    tokenExpiresAt: tstz('token_expires_at'),
    keyVersion: text('key_version').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    ...enumChecks(t),
  ],
).enableRLS();

export const sourceItems = pgTable(
  'source_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id').references(() => sourceConnections.id, { onDelete: 'set null' }),
    sourceType: text('source_type', {
      enum: [
        'github_repo',
        'github_contribution',
        'social_post',
        'portfolio_page',
        'uploaded_cv',
        'manual_experience',
        'job_description',
        'data_export',
        'linkedin_profile',
        'pasted_text',
      ],
    }).notNull(),
    providerItemId: text('provider_item_id'),
    canonicalUrl: text('canonical_url'),
    title: text('title'),
    bodyText: text('body_text'),
    sourceCreatedAt: tstz('source_created_at'),
    importedAt: tstz('imported_at').notNull().defaultNow(),
    updatedAt: updatedAt(),
    contentHash: text('content_hash'),
    rawObjectKey: text('raw_object_key'),
    permissionsJson: jsonb('permissions_json').$type<Record<string, unknown>>().notNull().default({}),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull().default({}),
    deletionStatus: text('deletion_status', { enum: ['active', 'pending_deletion', 'deleted'] })
      .notNull()
      .default('active'),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    
    uniqueIndex('source_items_provider_item_unique')
      .on(t.connectionId, t.providerItemId)
      .where(sql`${t.connectionId} is not null and ${t.providerItemId} is not null`),
    index('source_items_user_type_idx').on(t.userId, t.sourceType),
    index('source_items_content_hash_idx').on(t.userId, t.contentHash),
  ],
);

export const candidateEvidence = pgTable(
  'candidate_evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    evidenceType: text('evidence_type', {
      enum: [
        'skill',
        'project',
        'role',
        'achievement',
        'metric',
        'education',
        'certification',
        'responsibility',
        'publication',
        'leadership',
      ],
    }).notNull(),
    claimText: text('claim_text').notNull(),
    normalizedValue: text('normalized_value'),
    normalizedUnit: text('normalized_unit'),
    /** A ranking heuristic only. Truth comes from `verificationStatus`. */
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    verificationStatus: text('verification_status', {
      enum: ['unreviewed', 'user_confirmed', 'source_verified', 'rejected'],
    })
      .notNull()
      .default('unreviewed'),
    validFrom: date('valid_from'),
    validTo: date('valid_to'),
    contentHash: text('content_hash'),
    title: text('title'),
    pinned: boolean('pinned').notNull().default(false),
    excluded: boolean('excluded').notNull().default(false),
    userEdited: boolean('user_edited').notNull().default(false),
    /** The wording the entry was first made with. */
    originalText: text('original_text'),
    projectKey: text('project_key'),
    /** Where it came from, kept on the row so lists and counts need no joins. */
    sourceProvider: text('source_provider'),
    sourceWhere: text('source_where'),
    skills: text('skills').array().notNull().default(sql`'{}'`),
    /** Themes the entry shows (leadership, performance...), used to filter retrieval. */
    topics: text('topics').array().notNull().default(sql`'{}'`),
    /** Bumped on every change, so a stale edit can be refused. */
    version: integer('version').notNull().default(1),
    /** Generated by the database from `claim_text`; read only. */
    claimTsv: tsvector('claim_tsv').generatedAlwaysAs(sql`to_tsvector('english', claim_text)`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    check('candidate_evidence_confidence_check', sql`${t.confidence} between 0 and 1`),
    
    index('candidate_evidence_user_status_idx').on(t.userId, t.verificationStatus),
    index('candidate_evidence_project_idx').on(t.userId, t.projectKey),
    index('candidate_evidence_flags_idx').on(t.userId).where(sql`${t.pinned} or ${t.excluded}`),
    index('candidate_evidence_skills_idx').using('gin', t.skills),
    index('candidate_evidence_topics_idx').using('gin', t.topics),
    index('candidate_evidence_tsv_idx').using('gin', t.claimTsv),
  ],
);

export const evidenceEmbeddings = pgTable(
  'evidence_embeddings',
  {
    evidenceId: uuid('evidence_id').notNull().references(() => candidateEvidence.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    embeddingModel: text('embedding_model').notNull(),
    embeddingVersion: text('embedding_version').notNull(),
    contentHash: text('content_hash').notNull(),
    embedding: halfvec('embedding', { dimensions: 1536 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    primaryKey({ columns: [t.evidenceId, t.embeddingModel, t.embeddingVersion] }),
    index('evidence_embeddings_user_idx').on(t.userId),
    index('evidence_embeddings_hnsw_idx').using('hnsw', t.embedding.op('halfvec_cosine_ops')),
  ],
).enableRLS();

export const evidenceSources = pgTable(
  'evidence_sources',
  {
    evidenceId: uuid('evidence_id').notNull().references(() => candidateEvidence.id, { onDelete: 'cascade' }),
    sourceItemId: uuid('source_item_id').notNull().references(() => sourceItems.id, { onDelete: 'cascade' }),
    supportType: text('support_type', { enum: ['supports', 'mentions', 'user_statement'] })
      .notNull()
      .default('supports'),
    supportExcerpt: text('support_excerpt'),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    pgPolicy('evidence_sources_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`exists (select 1 from ${candidateEvidence} where ${candidateEvidence.id} = ${t.evidenceId} and ${candidateEvidence.userId} = (select auth.uid()))`,
    }),
    
    primaryKey({ columns: [t.evidenceId, t.sourceItemId] }),
    index('evidence_sources_source_item_idx').on(t.sourceItemId),
  ],
);

export const evidenceRelations = pgTable(
  'evidence_relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    fromEvidenceId: uuid('from_evidence_id').notNull().references(() => candidateEvidence.id, { onDelete: 'cascade' }),
    relationType: text('relation_type', {
      enum: [
        'demonstrates_skill',
        'belongs_to_project',
        'contributed_to_outcome',
        'used_technology',
        'supports_role_requirement',
        'derived_from',
        'contradicts',
        'possible_duplicate',
      ],
    }).notNull(),
    toEvidenceId: uuid('to_evidence_id').notNull().references(() => candidateEvidence.id, { onDelete: 'cascade' }),
    weight: numeric('weight', { precision: 4, scale: 3 }),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    
    check('evidence_relations_distinct', sql`${t.fromEvidenceId} <> ${t.toEvidenceId}`),
    unique().on(t.fromEvidenceId, t.relationType, t.toEvidenceId),
    index('evidence_relations_from_idx').on(t.userId, t.fromEvidenceId),
    index('evidence_relations_to_idx').on(t.userId, t.toEvidenceId),
  ],
);

// ─── Target roles, jobs, resumes ─────────────────────────────────────────────

export const targetOpportunities = pgTable(
  'target_opportunities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    company: text('company'),
    jobUrl: text('job_url'),
    jobDescriptionText: text('job_description_text').notNull(),
    roleFamily: text('role_family'),
    seniority: text('seniority'),
    location: text('location'),
    requirementsJson: jsonb('requirements_json').$type<unknown[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    index('target_opportunities_user_idx').on(t.userId, t.createdAt.desc()),
  ],
);

export const backgroundJobs = pgTable(
  'background_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    jobType: text('job_type', { enum: JOB_TYPES }).notNull(),
    status: text('status', { enum: JOB_STATUSES }).notNull().default('queued'),
    step: text('step', { enum: JOB_STEPS }),
    progressPercent: smallint('progress_percent'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    idempotencyKey: text('idempotency_key').notNull(),
    inputRefJson: jsonb('input_ref_json').$type<Record<string, unknown>>().notNull().default({}),
    resultRefJson: jsonb('result_ref_json').$type<Record<string, unknown>>(),
    errorCode: text('error_code'),
    safeErrorMessage: text('safe_error_message'),
    correlationId: text('correlation_id'),
    enqueueError: text('enqueue_error'),
    /** Bumped on every change. Used as the SSE event ID. */
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    startedAt: tstz('started_at'),
    heartbeatAt: tstz('heartbeat_at'),
    completedAt: tstz('completed_at'),
    cancelRequestedAt: tstz('cancel_requested_at'),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    check('background_jobs_progress_percent_range', sql`${t.progressPercent} between 0 and 100`),
    check('background_jobs_max_attempts_positive', sql`${t.maxAttempts} >= 1`),
    
    unique().on(t.userId, t.idempotencyKey),
    index('background_jobs_user_idx').on(t.userId, t.createdAt.desc()),
    index('background_jobs_open_idx')
      .on(t.status, t.updatedAt)
      .where(sql`${t.status} in ('queued', 'running', 'retry_wait')`),
  ],
);

export const resumeDocuments = pgTable(
  'resume_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    targetOpportunityId: uuid('target_opportunity_id').references(() => targetOpportunities.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    status: text('status', { enum: ['generating', 'draft', 'ready', 'failed', 'archived'] }).notNull().default('draft'),
    company: text('company'),
    length: text('length', { enum: ['one_page', 'full'] }).notNull().default('one_page'),
    roleId: text('role_id'),
    sourceSelection: text('source_selection').array().notNull().default(sql`'{}'`),
    focus: text('focus'),
    engine: text('engine').notNull().default('placeholder'),
    lastExportedAt: tstz('last_exported_at'),
    currentVersionId: uuid('current_version_id').references((): AnyPgColumn => resumeVersions.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    index('resume_documents_user_idx').on(t.userId, t.updatedAt.desc()),
  ],
);

export const generationRuns = pgTable(
  'generation_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    backgroundJobId: uuid('background_job_id').references(() => backgroundJobs.id, { onDelete: 'set null' }),
    targetOpportunityId: uuid('target_opportunity_id').references(() => targetOpportunities.id, {
      onDelete: 'set null',
    }),
    resumeDocumentId: uuid('resume_document_id').references(() => resumeDocuments.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'] })
      .notNull()
      .default('queued'),
    modelProvider: text('model_provider'),
    modelId: text('model_id'),
    stageModelsJson: jsonb('stage_models_json').$type<Record<string, unknown>>().notNull().default({}),
    promptVersion: text('prompt_version'),
    rubricVersion: text('rubric_version'),
    retrievalConfigVersion: text('retrieval_config_version'),
    userFocusJson: jsonb('user_focus_json').$type<Record<string, unknown>>().notNull().default({}),
    toolCallsJson: jsonb('tool_calls_json').$type<unknown[]>().notNull().default([]),
    retrievedEvidenceIds: uuid('retrieved_evidence_ids').array().notNull().default(sql`'{}'`),
    exampleIds: uuid('example_ids').array().notNull().default(sql`'{}'`),
    reviewJson: jsonb('review_json').$type<Record<string, unknown>>().notNull().default({}),
    metricsJson: jsonb('metrics_json').$type<Record<string, unknown>>().notNull().default({}),
    tokenUsageJson: jsonb('token_usage_json').$type<Record<string, unknown>>().notNull().default({}),
    costEstimate: numeric('cost_estimate', { precision: 10, scale: 4 }),
    failureCode: text('failure_code'),
    createdAt: createdAt(),
    startedAt: tstz('started_at'),
    completedAt: tstz('completed_at'),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    index('generation_runs_user_idx').on(t.userId, t.createdAt.desc()),
  ],
);

/** Edits and builds add versions. Nothing is overwritten. */
export const resumeVersions = pgTable(
  'resume_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resumeDocumentId: uuid('resume_document_id')
      .notNull()
      .references(() => resumeDocuments.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    contentJson: jsonb('content_json').$type<Record<string, unknown>>().notNull(),
    plainText: text('plain_text'),
    layoutKey: text('layout_key').notNull().default('a4'),
    generationRunId: uuid('generation_run_id').references(() => generationRuns.id, { onDelete: 'set null' }),
    createdBy: text('created_by', { enum: ['ai', 'user', 'import'] }).notNull(),
    validationSummaryJson: jsonb('validation_summary_json').$type<Record<string, unknown>>().notNull().default({}),
    pdfObjectKey: text('pdf_object_key'),
    docxObjectKey: text('docx_object_key'),
    exportStatus: text('export_status', { enum: ['queued', 'ready', 'failed'] }),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    pgPolicy('resume_versions_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`exists (select 1 from ${resumeDocuments} where ${resumeDocuments.id} = ${t.resumeDocumentId} and ${resumeDocuments.userId} = (select auth.uid()))`,
    }),
    unique().on(t.resumeDocumentId, t.versionNumber),
  ],
);

// ─── Examples, rubrics, notifications, audit ─────────────────────────────────

export const resumeExamples = pgTable(
  'resume_examples',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleFamily: text('role_family').notNull(),
    seniority: text('seniority').notNull(),
    locale: text('locale').notNull().default('en'),
    layoutKey: text('layout_key').notNull().default('a4'),
    exampleKind: text('example_kind', { enum: ['good', 'annotated_bad'] }).notNull(),
    exampleContentJson: jsonb('example_content_json').$type<Record<string, unknown>>().notNull(),
    annotationsJson: jsonb('annotations_json').$type<unknown[]>().notNull().default([]),
    qualityNotes: text('quality_notes'),
    rightsStatus: text('rights_status', { enum: ['owned', 'licensed', 'synthetic'] }).notNull(),
    active: boolean('active').notNull().default(true),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    
    index('resume_examples_lookup_idx').on(t.roleFamily, t.seniority, t.exampleKind).where(sql`${t.active}`),
  ],
).enableRLS();

export const roleRubrics = pgTable(
  'role_rubrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleFamily: text('role_family').notNull(),
    seniority: text('seniority').notNull(),
    version: integer('version').notNull(),
    criteriaJson: jsonb('criteria_json').$type<unknown>().notNull(),
    weightsJson: jsonb('weights_json').$type<Record<string, number>>().notNull(),
    toneProfileJson: jsonb('tone_profile_json').$type<Record<string, unknown>>().notNull().default({}),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    unique().on(t.roleFamily, t.seniority, t.version),
  ],
).enableRLS();

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => backgroundJobs.id, { onDelete: 'set null' }),
    channel: text('channel', { enum: ['in_app', 'email'] }).notNull(),
    template: text('template').notNull(),
    payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
    deliveryStatus: text('delivery_status', { enum: ['pending', 'sent', 'failed', 'skipped'] })
      .notNull()
      .default('pending'),
    /** One send per event and channel, however many times the job is delivered. */
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: createdAt(),
    sentAt: tstz('sent_at'),
    readAt: tstz('read_at'),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    unique().on(t.userId, t.idempotencyKey), index('notifications_user_idx').on(t.userId, t.createdAt.desc()),
  ],
);

/** Security-relevant actions. Never store document contents here. */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    eventType: text('event_type').notNull(),
    subjectType: text('subject_type'),
    subjectId: uuid('subject_id'),
    correlationId: text('correlation_id'),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull().default({}),
    clientId: uuid('client_id').references(() => apiClients.id, { onDelete: 'set null' }),
    keyId: uuid('key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
    /** Who did it: a staff member's ID, a user, or "api". */
    actor: text('actor'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    index('audit_events_user_idx').on(t.userId, t.createdAt.desc()),
    index('audit_events_client_idx').on(t.clientId, t.createdAt.desc()),
  ],
).enableRLS();

// ─── Organisation API, consents (PRD data model) ─────────────────────────────

export const apiClients = pgTable(
  'api_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    status: text('status', { enum: ['pending', 'active', 'suspended'] }).notNull().default('pending'),
    contactEmail: text('contact_email'),
    monthlyQuota: integer('monthly_quota').notNull().default(5000),
    webhookUrl: text('webhook_url'),
    webhookSecretEncrypted: text('webhook_secret_encrypted'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    ...enumChecks(t),
  ],
).enableRLS();

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id').notNull().references(() => apiClients.id, { onDelete: 'cascade' }),
    prefix: text('prefix').notNull().unique(),
    /** Only a hash of the secret is stored; the secret is shown once. */
    secretHash: text('secret_hash').notNull(),
    mode: text('mode', { enum: ['test', 'live'] }).notNull().default('live'),
    scopes: text('scopes').array().notNull().default(sql`'{}'`),
    expiresAt: tstz('expires_at'),
    revokedAt: tstz('revoked_at'),
    label: text('label').notNull().default('Key'),
    rateLimitPerMin: integer('rate_limit_per_min').notNull().default(60),
    monthlyQuota: integer('monthly_quota'),
    lastUsedAt: tstz('last_used_at'),
    lastUsedIp: text('last_used_ip'),
    /** A rotated key keeps working until this time. */
    stopsAt: tstz('stops_at'),
    rotatedFrom: uuid('rotated_from').references((): AnyPgColumn => apiKeys.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    check('api_keys_rate_limit_positive', sql`${t.rateLimitPerMin} > 0`),
    index('api_keys_client_idx').on(t.clientId),
  ],
).enableRLS();

export const apiUsageEvents = pgTable(
  'api_usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyId: uuid('key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    status: integer('status').notNull(),
    costUnits: integer('cost_units').notNull().default(1),
    ip: text('ip'),
    at: tstz('at').notNull().defaultNow(),
  },
  (t) => [
    ...enumChecks(t),
    index('api_usage_events_key_idx').on(t.keyId, t.at.desc()),
  ],
).enableRLS();

/** A user grants an organisation client access to a scope of their data. */
export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull().references(() => apiClients.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    grantedAt: tstz('granted_at').notNull().defaultNow(),
    revokedAt: tstz('revoked_at'),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    
    uniqueIndex('consents_active_unique').on(t.userId, t.clientId, t.scope).where(sql`${t.revokedAt} is null`),
    index('consents_client_idx').on(t.clientId),
  ],
);

// ─── Billing ─────────────────────────────────────────────────────────────────

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id'),
    providerSubscriptionId: text('provider_subscription_id'),
    plan: text('plan', { enum: ['free', 'pro'] }).notNull(),
    status: text('status', { enum: ['active', 'trialing', 'past_due', 'cancelled', 'expired'] }).notNull(),
    currentPeriodStart: tstz('current_period_start'),
    currentPeriodEnd: tstz('current_period_end'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    providerEmailToken: text('provider_email_token'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    
    index('subscriptions_user_idx').on(t.userId),
    uniqueIndex('subscriptions_provider_unique')
      .on(t.provider, t.providerSubscriptionId)
      .where(sql`${t.providerSubscriptionId} is not null`),
  ],
);

/** Reference, amount and time. No card data. */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
    /** Kept when the account is deleted: payment records are not personal data we may erase. */
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    provider: text('provider').notNull(),
    providerReference: text('provider_reference').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull(),
    status: text('status', { enum: ['pending', 'succeeded', 'failed', 'refunded'] }).notNull(),
    paidAt: tstz('paid_at'),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    check('payments_amount_minor_positive', sql`${t.amountMinor} >= 0`),
    unique().on(t.provider, t.providerReference), index('payments_user_idx').on(t.userId, t.createdAt.desc()),
  ],
);

/** One row per provider event, so a redelivered webhook is applied once. */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
    receivedAt: tstz('received_at').notNull().defaultNow(),
    processedAt: tstz('processed_at'),
  },
  (t) => [
    ...enumChecks(t),
    unique().on(t.provider, t.providerEventId),
  ],
).enableRLS();

export const usageCounters = pgTable(
  'usage_counters',
  {
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    metric: text('metric').notNull(),
    periodStart: date('period_start').notNull(),
    count: integer('count').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    check('usage_counters_count_positive', sql`${t.count} >= 0`),
    primaryKey({ columns: [t.userId, t.metric, t.periodStart] }),
  ],
);

// ─── Model calls and deletion ────────────────────────────────────────────────

/** Metadata only. Prompt text is not stored by default. Retained 90 days. */
export const llmCalls = pgTable(
  'llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    generationRunId: uuid('generation_run_id').references(() => generationRuns.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    role: text('role', { enum: ['write', 'check', 'extract', 'embed'] }).notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    costEstimate: numeric('cost_estimate', { precision: 10, scale: 6 }),
    latencyMs: integer('latency_ms'),
    status: text('status', { enum: ['ok', 'error', 'timeout', 'refused', 'truncated'] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    index('llm_calls_run_idx').on(t.generationRunId), index('llm_calls_created_idx').on(t.createdAt),
  ],
).enableRLS();

export const deletionRequests = pgTable(
  'deletion_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Not a foreign key: kept after the profile is gone, so completion can be proven. */
    userId: uuid('user_id').notNull(),
    status: text('status', { enum: ['requested', 'in_progress', 'completed', 'failed'] })
      .notNull()
      .default('requested'),
    requestedAt: tstz('requested_at').notNull().defaultNow(),
    dueAt: tstz('due_at').notNull().default(sql`now() + interval '30 days'`),
    completedAt: tstz('completed_at'),
  },
  (t) => [
    ...enumChecks(t),
    index('deletion_requests_status_idx').on(t.status, t.dueAt),
  ],
).enableRLS();

// ─── Added by the product API migration (20261022000100) ─────────────────────

export const userPolicyConsents = pgTable(
  'user_policy_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    purpose: text('purpose', { enum: ['terms', 'privacy', 'ai_processing'] }).notNull(),
    textVersion: text('text_version').notNull(),
    grantedAt: tstz('granted_at').notNull().defaultNow(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    unique('user_policy_consents_unique').on(t.userId, t.purpose, t.textVersion),
  ],
);

export const cvReviews = pgTable(
  'cv_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    sourceItemId: uuid('source_item_id').references(() => sourceItems.id, { onDelete: 'set null' }),
    roleFamily: text('role_family'),
    resultJson: jsonb('result_json').$type<Record<string, unknown>>().notNull(),
    engine: text('engine').notNull().default('placeholder'),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    ownRows(t.userId),
    index('cv_reviews_user_idx').on(t.userId, t.createdAt.desc()),
  ],
);

/** An organisation asks a person for access; the person decides on a Tracck page. */
export const consentRequests = pgTable(
  'consent_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id').notNull().references(() => apiClients.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    scopes: text('scopes').array().notNull(),
    externalRef: text('external_ref'),
    status: text('status', { enum: ['pending', 'granted', 'denied', 'expired'] }).notNull().default('pending'),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    expiresAt: tstz('expires_at').notNull(),
    createdAt: createdAt(),
    decidedAt: tstz('decided_at'),
  },
  (t) => [
    ...enumChecks(t),
    index('consent_requests_client_idx').on(t.clientId, t.createdAt.desc()),
  ],
).enableRLS();

/** Organisation API waitlist (migration 20261019000100). Insert-only from the browser. */
export const orgWaitlist = pgTable(
  'org_waitlist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgName: text('org_name').notNull(),
    contactName: text('contact_name').notNull(),
    email: text('email').notNull(),
    orgType: text('org_type', { enum: ['university', 'bootcamp', 'job_platform', 'other'] }).notNull(),
    volume: text('volume'),
    message: text('message'),
    createdAt: createdAt(),
  },
  (t) => [
    ...enumChecks(t),
    pgPolicy('org_waitlist_insert', { for: 'insert', to: [anonRole, authenticatedRole], withCheck: sql`true` }),
    uniqueIndex('org_waitlist_email_idx').on(sql`lower(${t.email})`),
    check('org_waitlist_org_name_length', sql`char_length(${t.orgName}) between 1 and 200`),
    check('org_waitlist_contact_name_length', sql`char_length(${t.contactName}) between 1 and 200`),
    check('org_waitlist_email_shape', sql`char_length(${t.email}) between 3 and 320 and ${t.email} like '%_@_%._%'`),
    check('org_waitlist_volume_length', sql`${t.volume} is null or char_length(${t.volume}) <= 100`),
    check('org_waitlist_message_length', sql`${t.message} is null or char_length(${t.message}) <= 2000`),
  ],
);
