CREATE TABLE "api_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"contact_email" text,
	"monthly_quota" integer DEFAULT 5000 NOT NULL,
	"webhook_url" text,
	"webhook_secret_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_clients_status_check" CHECK ("api_clients"."status" in ('pending', 'active', 'suspended'))
);
--> statement-breakpoint
ALTER TABLE "api_clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"prefix" text NOT NULL,
	"secret_hash" text NOT NULL,
	"mode" text DEFAULT 'live' NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"label" text DEFAULT 'Key' NOT NULL,
	"rate_limit_per_min" integer DEFAULT 60 NOT NULL,
	"monthly_quota" integer,
	"last_used_at" timestamp with time zone,
	"last_used_ip" text,
	"stops_at" timestamp with time zone,
	"rotated_from" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_prefix_unique" UNIQUE("prefix"),
	CONSTRAINT "api_keys_mode_check" CHECK ("api_keys"."mode" in ('test', 'live')),
	CONSTRAINT "api_keys_rate_limit_positive" CHECK ("api_keys"."rate_limit_per_min" > 0)
);
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"status" integer NOT NULL,
	"cost_units" integer DEFAULT 1 NOT NULL,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_usage_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"correlation_id" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"client_id" uuid,
	"key_id" uuid,
	"actor" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"step" text,
	"progress_percent" smallint,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"idempotency_key" text NOT NULL,
	"input_ref_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_ref_json" jsonb,
	"error_code" text,
	"safe_error_message" text,
	"correlation_id" text,
	"enqueue_error" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	CONSTRAINT "background_jobs_user_id_idempotency_key_unique" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "background_jobs_job_type_check" CHECK ("background_jobs"."job_type" in ('source_import', 'cv_parse', 'cv_review', 'profile_index', 'resume_generation', 'resume_export', 'source_sync', 'cleanup', 'diagnostic', 'data_export', 'account_deletion', 'email_send', 'webhook_delivery', 'weekly_digest')),
	CONSTRAINT "background_jobs_status_check" CHECK ("background_jobs"."status" in ('queued', 'running', 'retry_wait', 'succeeded', 'failed', 'cancelled', 'needs_user_action')),
	CONSTRAINT "background_jobs_step_check" CHECK ("background_jobs"."step" in ('download_source', 'parse_cv', 'normalize', 'embed', 'retrieve', 'draft', 'critique', 'revise', 'validate', 'export', 'notify')),
	CONSTRAINT "background_jobs_progress_percent_range" CHECK ("background_jobs"."progress_percent" between 0 and 100),
	CONSTRAINT "background_jobs_max_attempts_positive" CHECK ("background_jobs"."max_attempts" >= 1)
);
--> statement-breakpoint
ALTER TABLE "background_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "candidate_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"evidence_type" text NOT NULL,
	"claim_text" text NOT NULL,
	"normalized_value" text,
	"normalized_unit" text,
	"confidence" numeric(4, 3),
	"verification_status" text DEFAULT 'unreviewed' NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"content_hash" text,
	"title" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"original_text" text,
	"project_key" text,
	"source_provider" text,
	"source_where" text,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"claim_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', claim_text)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_evidence_evidence_type_check" CHECK ("candidate_evidence"."evidence_type" in ('skill', 'project', 'role', 'achievement', 'metric', 'education', 'certification', 'responsibility', 'publication', 'leadership')),
	CONSTRAINT "candidate_evidence_verification_status_check" CHECK ("candidate_evidence"."verification_status" in ('unreviewed', 'user_confirmed', 'source_verified', 'rejected')),
	CONSTRAINT "candidate_evidence_confidence_check" CHECK ("candidate_evidence"."confidence" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "candidate_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consent_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" text[] NOT NULL,
	"external_ref" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "consent_requests_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "consent_requests_status_check" CHECK ("consent_requests"."status" in ('pending', 'granted', 'denied', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "consent_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cv_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_item_id" uuid,
	"role_family" text,
	"result_json" jsonb NOT NULL,
	"engine" text DEFAULT 'placeholder' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cv_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() + interval '30 days' NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "deletion_requests_status_check" CHECK ("deletion_requests"."status" in ('requested', 'in_progress', 'completed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "deletion_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evidence_embeddings" (
	"evidence_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding_version" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" halfvec(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_embeddings_evidence_id_embedding_model_embedding_version_pk" PRIMARY KEY("evidence_id","embedding_model","embedding_version")
);
--> statement-breakpoint
ALTER TABLE "evidence_embeddings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evidence_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_evidence_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"to_evidence_id" uuid NOT NULL,
	"weight" numeric(4, 3),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_relations_from_evidence_id_relation_type_to_evidence_id_unique" UNIQUE("from_evidence_id","relation_type","to_evidence_id"),
	CONSTRAINT "evidence_relations_relation_type_check" CHECK ("evidence_relations"."relation_type" in ('demonstrates_skill', 'belongs_to_project', 'contributed_to_outcome', 'used_technology', 'supports_role_requirement', 'derived_from', 'contradicts', 'possible_duplicate')),
	CONSTRAINT "evidence_relations_distinct" CHECK ("evidence_relations"."from_evidence_id" <> "evidence_relations"."to_evidence_id")
);
--> statement-breakpoint
ALTER TABLE "evidence_relations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evidence_sources" (
	"evidence_id" uuid NOT NULL,
	"source_item_id" uuid NOT NULL,
	"support_type" text DEFAULT 'supports' NOT NULL,
	"support_excerpt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_sources_evidence_id_source_item_id_pk" PRIMARY KEY("evidence_id","source_item_id"),
	CONSTRAINT "evidence_sources_support_type_check" CHECK ("evidence_sources"."support_type" in ('supports', 'mentions', 'user_statement'))
);
--> statement-breakpoint
ALTER TABLE "evidence_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"background_job_id" uuid,
	"target_opportunity_id" uuid,
	"resume_document_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"model_provider" text,
	"model_id" text,
	"stage_models_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prompt_version" text,
	"rubric_version" text,
	"retrieval_config_version" text,
	"user_focus_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tool_calls_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retrieved_evidence_ids" uuid[] DEFAULT '{}' NOT NULL,
	"example_ids" uuid[] DEFAULT '{}' NOT NULL,
	"review_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"token_usage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_estimate" numeric(10, 4),
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "generation_runs_status_check" CHECK ("generation_runs"."status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "generation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_run_id" uuid,
	"user_id" uuid,
	"role" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_estimate" numeric(10, 6),
	"latency_ms" integer,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "llm_calls_role_check" CHECK ("llm_calls"."role" in ('write', 'check', 'extract', 'embed')),
	CONSTRAINT "llm_calls_status_check" CHECK ("llm_calls"."status" in ('ok', 'error', 'timeout', 'refused', 'truncated'))
);
--> statement-breakpoint
ALTER TABLE "llm_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	CONSTRAINT "notifications_user_id_idempotency_key_unique" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "notifications_channel_check" CHECK ("notifications"."channel" in ('in_app', 'email')),
	CONSTRAINT "notifications_delivery_status_check" CHECK ("notifications"."delivery_status" in ('pending', 'sent', 'failed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "org_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"org_type" text NOT NULL,
	"volume" text,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_waitlist_org_type_check" CHECK ("org_waitlist"."org_type" in ('university', 'bootcamp', 'job_platform', 'other')),
	CONSTRAINT "org_waitlist_org_name_length" CHECK (char_length("org_waitlist"."org_name") between 1 and 200),
	CONSTRAINT "org_waitlist_contact_name_length" CHECK (char_length("org_waitlist"."contact_name") between 1 and 200),
	CONSTRAINT "org_waitlist_email_shape" CHECK (char_length("org_waitlist"."email") between 3 and 320 and "org_waitlist"."email" like '%_@_%._%'),
	CONSTRAINT "org_waitlist_volume_length" CHECK ("org_waitlist"."volume" is null or char_length("org_waitlist"."volume") <= 100),
	CONSTRAINT "org_waitlist_message_length" CHECK ("org_waitlist"."message" is null or char_length("org_waitlist"."message") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "org_waitlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_provider_reference_unique" UNIQUE("provider","provider_reference"),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" in ('pending', 'succeeded', 'failed', 'refunded')),
	CONSTRAINT "payments_amount_minor_positive" CHECK ("payments"."amount_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"headline" text,
	"location" text,
	"summary" text,
	"career_level" text,
	"preferred_roles" text[] DEFAULT '{}' NOT NULL,
	"preferences_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"primary_role" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"deleted_at" timestamp with time zone,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_plan_check" CHECK ("profiles"."plan" in ('free', 'pro'))
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resume_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_opportunity_id" uuid,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"company" text,
	"length" text DEFAULT 'one_page' NOT NULL,
	"role_id" text,
	"source_selection" text[] DEFAULT '{}' NOT NULL,
	"focus" text,
	"engine" text DEFAULT 'placeholder' NOT NULL,
	"last_exported_at" timestamp with time zone,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_documents_status_check" CHECK ("resume_documents"."status" in ('generating', 'draft', 'ready', 'failed', 'archived')),
	CONSTRAINT "resume_documents_length_check" CHECK ("resume_documents"."length" in ('one_page', 'full'))
);
--> statement-breakpoint
ALTER TABLE "resume_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resume_examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_family" text NOT NULL,
	"seniority" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"layout_key" text DEFAULT 'a4' NOT NULL,
	"example_kind" text NOT NULL,
	"example_content_json" jsonb NOT NULL,
	"annotations_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quality_notes" text,
	"rights_status" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_examples_example_kind_check" CHECK ("resume_examples"."example_kind" in ('good', 'annotated_bad')),
	CONSTRAINT "resume_examples_rights_status_check" CHECK ("resume_examples"."rights_status" in ('owned', 'licensed', 'synthetic'))
);
--> statement-breakpoint
ALTER TABLE "resume_examples" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resume_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content_json" jsonb NOT NULL,
	"plain_text" text,
	"layout_key" text DEFAULT 'a4' NOT NULL,
	"generation_run_id" uuid,
	"created_by" text NOT NULL,
	"validation_summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pdf_object_key" text,
	"docx_object_key" text,
	"export_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_versions_resume_document_id_version_number_unique" UNIQUE("resume_document_id","version_number"),
	CONSTRAINT "resume_versions_created_by_check" CHECK ("resume_versions"."created_by" in ('ai', 'user', 'import')),
	CONSTRAINT "resume_versions_export_status_check" CHECK ("resume_versions"."export_status" in ('queued', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "resume_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "role_rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_family" text NOT NULL,
	"seniority" text NOT NULL,
	"version" integer NOT NULL,
	"criteria_json" jsonb NOT NULL,
	"weights_json" jsonb NOT NULL,
	"tone_profile_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_rubrics_role_family_seniority_version_unique" UNIQUE("role_family","seniority","version")
);
--> statement-breakpoint
ALTER TABLE "role_rubrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_connection_secrets" (
	"connection_id" uuid PRIMARY KEY NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"key_version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_connection_secrets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text,
	"display_handle" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"granted_scopes" text[] DEFAULT '{}' NOT NULL,
	"consent_version" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error_code" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_connections_status_check" CHECK ("source_connections"."status" in ('not_connected', 'connected', 'sync_queued', 'syncing', 'synced', 'partial', 'needs_reauth', 'error'))
);
--> statement-breakpoint
ALTER TABLE "source_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid,
	"source_type" text NOT NULL,
	"provider_item_id" text,
	"canonical_url" text,
	"title" text,
	"body_text" text,
	"source_created_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text,
	"raw_object_key" text,
	"permissions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deletion_status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "source_items_source_type_check" CHECK ("source_items"."source_type" in ('github_repo', 'github_contribution', 'social_post', 'portfolio_page', 'uploaded_cv', 'manual_experience', 'job_description', 'data_export', 'linkedin_profile', 'pasted_text')),
	CONSTRAINT "source_items_deletion_status_check" CHECK ("source_items"."deletion_status" in ('active', 'pending_deletion', 'deleted'))
);
--> statement-breakpoint
ALTER TABLE "source_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"provider_email_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_plan_check" CHECK ("subscriptions"."plan" in ('free', 'pro')),
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" in ('active', 'trialing', 'past_due', 'cancelled', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "target_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"company" text,
	"job_url" text,
	"job_description_text" text NOT NULL,
	"role_family" text,
	"seniority" text,
	"location" text,
	"requirements_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "target_opportunities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"user_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"period_start" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_counters_user_id_metric_period_start_pk" PRIMARY KEY("user_id","metric","period_start"),
	CONSTRAINT "usage_counters_count_positive" CHECK ("usage_counters"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "usage_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_policy_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"text_version" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_policy_consents_unique" UNIQUE("user_id","purpose","text_version"),
	CONSTRAINT "user_policy_consents_purpose_check" CHECK ("user_policy_consents"."purpose" in ('terms', 'privacy', 'ai_processing'))
);
--> statement-breakpoint
ALTER TABLE "user_policy_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "webhook_events_provider_provider_event_id_unique" UNIQUE("provider","provider_event_id")
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_client_id_api_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_rotated_from_api_keys_id_fk" FOREIGN KEY ("rotated_from") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_events" ADD CONSTRAINT "api_usage_events_key_id_api_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_client_id_api_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."api_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_key_id_api_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_evidence" ADD CONSTRAINT "candidate_evidence_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_client_id_api_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_client_id_api_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_reviews" ADD CONSTRAINT "cv_reviews_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_reviews" ADD CONSTRAINT "cv_reviews_source_item_id_source_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."source_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_embeddings" ADD CONSTRAINT "evidence_embeddings_evidence_id_candidate_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."candidate_evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_embeddings" ADD CONSTRAINT "evidence_embeddings_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_relations" ADD CONSTRAINT "evidence_relations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_relations" ADD CONSTRAINT "evidence_relations_from_evidence_id_candidate_evidence_id_fk" FOREIGN KEY ("from_evidence_id") REFERENCES "public"."candidate_evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_relations" ADD CONSTRAINT "evidence_relations_to_evidence_id_candidate_evidence_id_fk" FOREIGN KEY ("to_evidence_id") REFERENCES "public"."candidate_evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_sources" ADD CONSTRAINT "evidence_sources_evidence_id_candidate_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."candidate_evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_sources" ADD CONSTRAINT "evidence_sources_source_item_id_source_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."source_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_background_job_id_background_jobs_id_fk" FOREIGN KEY ("background_job_id") REFERENCES "public"."background_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_target_opportunity_id_target_opportunities_id_fk" FOREIGN KEY ("target_opportunity_id") REFERENCES "public"."target_opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_resume_document_id_resume_documents_id_fk" FOREIGN KEY ("resume_document_id") REFERENCES "public"."resume_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_generation_run_id_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."generation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_job_id_background_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."background_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_documents" ADD CONSTRAINT "resume_documents_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_documents" ADD CONSTRAINT "resume_documents_target_opportunity_id_target_opportunities_id_fk" FOREIGN KEY ("target_opportunity_id") REFERENCES "public"."target_opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_documents" ADD CONSTRAINT "resume_documents_current_version_id_resume_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."resume_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_resume_document_id_resume_documents_id_fk" FOREIGN KEY ("resume_document_id") REFERENCES "public"."resume_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_generation_run_id_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."generation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_connection_secrets" ADD CONSTRAINT "source_connection_secrets_connection_id_source_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."source_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_items" ADD CONSTRAINT "source_items_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_items" ADD CONSTRAINT "source_items_connection_id_source_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."source_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_opportunities" ADD CONSTRAINT "target_opportunities_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_policy_consents" ADD CONSTRAINT "user_policy_consents_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_client_idx" ON "api_keys" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "api_usage_events_key_idx" ON "api_usage_events" USING btree ("key_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_user_idx" ON "audit_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_client_idx" ON "audit_events" USING btree ("client_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "background_jobs_user_idx" ON "background_jobs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "background_jobs_open_idx" ON "background_jobs" USING btree ("status","updated_at") WHERE "background_jobs"."status" in ('queued', 'running', 'retry_wait');--> statement-breakpoint
CREATE INDEX "candidate_evidence_user_status_idx" ON "candidate_evidence" USING btree ("user_id","verification_status");--> statement-breakpoint
CREATE INDEX "candidate_evidence_project_idx" ON "candidate_evidence" USING btree ("user_id","project_key");--> statement-breakpoint
CREATE INDEX "candidate_evidence_flags_idx" ON "candidate_evidence" USING btree ("user_id") WHERE "candidate_evidence"."pinned" or "candidate_evidence"."excluded";--> statement-breakpoint
CREATE INDEX "candidate_evidence_skills_idx" ON "candidate_evidence" USING gin ("skills");--> statement-breakpoint
CREATE INDEX "candidate_evidence_topics_idx" ON "candidate_evidence" USING gin ("topics");--> statement-breakpoint
CREATE INDEX "candidate_evidence_tsv_idx" ON "candidate_evidence" USING gin ("claim_tsv");--> statement-breakpoint
CREATE INDEX "consent_requests_client_idx" ON "consent_requests" USING btree ("client_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "consents_active_unique" ON "consents" USING btree ("user_id","client_id","scope") WHERE "consents"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "consents_client_idx" ON "consents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cv_reviews_user_idx" ON "cv_reviews" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "deletion_requests_status_idx" ON "deletion_requests" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "evidence_embeddings_user_idx" ON "evidence_embeddings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "evidence_embeddings_hnsw_idx" ON "evidence_embeddings" USING hnsw ("embedding" halfvec_cosine_ops);--> statement-breakpoint
CREATE INDEX "evidence_relations_from_idx" ON "evidence_relations" USING btree ("user_id","from_evidence_id");--> statement-breakpoint
CREATE INDEX "evidence_relations_to_idx" ON "evidence_relations" USING btree ("user_id","to_evidence_id");--> statement-breakpoint
CREATE INDEX "evidence_sources_source_item_idx" ON "evidence_sources" USING btree ("source_item_id");--> statement-breakpoint
CREATE INDEX "generation_runs_user_idx" ON "generation_runs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "llm_calls_run_idx" ON "llm_calls" USING btree ("generation_run_id");--> statement-breakpoint
CREATE INDEX "llm_calls_created_idx" ON "llm_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "org_waitlist_email_idx" ON "org_waitlist" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "resume_documents_user_idx" ON "resume_documents" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "resume_examples_lookup_idx" ON "resume_examples" USING btree ("role_family","seniority","example_kind") WHERE "resume_examples"."active";--> statement-breakpoint
CREATE UNIQUE INDEX "source_connections_account_unique" ON "source_connections" USING btree ("user_id","provider","provider_account_id") WHERE "source_connections"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "source_connections_user_idx" ON "source_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_items_provider_item_unique" ON "source_items" USING btree ("connection_id","provider_item_id") WHERE "source_items"."connection_id" is not null and "source_items"."provider_item_id" is not null;--> statement-breakpoint
CREATE INDEX "source_items_user_type_idx" ON "source_items" USING btree ("user_id","source_type");--> statement-breakpoint
CREATE INDEX "source_items_content_hash_idx" ON "source_items" USING btree ("user_id","content_hash");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_unique" ON "subscriptions" USING btree ("provider","provider_subscription_id") WHERE "subscriptions"."provider_subscription_id" is not null;--> statement-breakpoint
CREATE INDEX "target_opportunities_user_idx" ON "target_opportunities" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "background_jobs_select_own" ON "background_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "background_jobs"."user_id");--> statement-breakpoint
CREATE POLICY "candidate_evidence_select_own" ON "candidate_evidence" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "candidate_evidence"."user_id");--> statement-breakpoint
CREATE POLICY "consents_select_own" ON "consents" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "consents"."user_id");--> statement-breakpoint
CREATE POLICY "cv_reviews_select_own" ON "cv_reviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "cv_reviews"."user_id");--> statement-breakpoint
CREATE POLICY "evidence_relations_select_own" ON "evidence_relations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "evidence_relations"."user_id");--> statement-breakpoint
CREATE POLICY "evidence_sources_select_own" ON "evidence_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from "candidate_evidence" where "candidate_evidence"."id" = "evidence_sources"."evidence_id" and "candidate_evidence"."user_id" = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "generation_runs_select_own" ON "generation_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "generation_runs"."user_id");--> statement-breakpoint
CREATE POLICY "notifications_select_own" ON "notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "notifications"."user_id");--> statement-breakpoint
CREATE POLICY "org_waitlist_insert" ON "org_waitlist" AS PERMISSIVE FOR INSERT TO "anon", "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "payments_select_own" ON "payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "payments"."user_id");--> statement-breakpoint
CREATE POLICY "profiles_select_own" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "profiles"."id");--> statement-breakpoint
CREATE POLICY "resume_documents_select_own" ON "resume_documents" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "resume_documents"."user_id");--> statement-breakpoint
CREATE POLICY "resume_versions_select_own" ON "resume_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from "resume_documents" where "resume_documents"."id" = "resume_versions"."resume_document_id" and "resume_documents"."user_id" = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "source_connections_select_own" ON "source_connections" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "source_connections"."user_id");--> statement-breakpoint
CREATE POLICY "source_items_select_own" ON "source_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "source_items"."user_id");--> statement-breakpoint
CREATE POLICY "subscriptions_select_own" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "subscriptions"."user_id");--> statement-breakpoint
CREATE POLICY "target_opportunities_select_own" ON "target_opportunities" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "target_opportunities"."user_id");--> statement-breakpoint
CREATE POLICY "usage_counters_select_own" ON "usage_counters" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "usage_counters"."user_id");--> statement-breakpoint
CREATE POLICY "user_policy_consents_select_own" ON "user_policy_consents" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "user_policy_consents"."user_id");