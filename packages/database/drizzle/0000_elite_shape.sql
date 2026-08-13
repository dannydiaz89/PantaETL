CREATE TYPE "public"."artifact_storage_kind" AS ENUM('local', 's3');--> statement-breakpoint
CREATE TYPE "public"."component_kind" AS ENUM('source', 'transform', 'export');--> statement-breakpoint
CREATE TYPE "public"."job_state" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pipeline_state" AS ENUM('draft', 'enabled', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."run_state" AS ENUM('queued', 'running', 'succeeded', 'completed_with_warnings', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."run_step_state" AS ENUM('queued', 'running', 'succeeded', 'completed_with_warnings', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('manual', 'schedule');--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"format" text NOT NULL,
	"content_type" text,
	"file_name" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"storage_kind" "artifact_storage_kind" NOT NULL,
	"storage_location" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"run_step_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"state" "job_state" DEFAULT 'queued' NOT NULL,
	"retry_max_attempts" integer DEFAULT 1 NOT NULL,
	"retry_delay_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"state" "run_step_state" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" jsonb
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"contract_version" text DEFAULT 'v1' NOT NULL,
	"state" "run_state" DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancellation_requested_at" timestamp with time zone,
	"cancellation_requested_by_user_id" uuid,
	"warning_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"kind" "component_kind" NOT NULL,
	"component_type" text NOT NULL,
	"component_version" text NOT NULL,
	"configuration_values" jsonb NOT NULL,
	"secret_bindings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "pipeline_components_pipeline_id_id_unique" UNIQUE("pipeline_id","id")
);
--> statement-breakpoint
CREATE TABLE "pipeline_edges" (
	"pipeline_id" uuid NOT NULL,
	"from_component_id" uuid NOT NULL,
	"to_component_id" uuid NOT NULL,
	CONSTRAINT "pipeline_edges_primary_key" PRIMARY KEY("pipeline_id","from_component_id","to_component_id")
);
--> statement-breakpoint
CREATE TABLE "pipeline_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"type" "trigger_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"cron" text,
	"timezone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"contract_version" text DEFAULT 'v1' NOT NULL,
	"name" text NOT NULL,
	"state" "pipeline_state" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"requires_password_change" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_run_step_id_run_steps_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."run_steps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_component_id_pipeline_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."pipeline_components"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_component_id_pipeline_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."pipeline_components"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_cancellation_requested_by_user_id_users_id_fk" FOREIGN KEY ("cancellation_requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_components" ADD CONSTRAINT "pipeline_components_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_edges" ADD CONSTRAINT "pipeline_edges_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_edges" ADD CONSTRAINT "pipeline_edges_from_component_foreign_key" FOREIGN KEY ("pipeline_id","from_component_id") REFERENCES "public"."pipeline_components"("pipeline_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_edges" ADD CONSTRAINT "pipeline_edges_to_component_foreign_key" FOREIGN KEY ("pipeline_id","to_component_id") REFERENCES "public"."pipeline_components"("pipeline_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_triggers" ADD CONSTRAINT "pipeline_triggers_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifacts_run_id_index" ON "artifacts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "jobs_run_id_index" ON "jobs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_steps_run_id_index" ON "run_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "runs_pipeline_id_created_at_index" ON "runs" USING btree ("pipeline_id","created_at");--> statement-breakpoint
CREATE INDEX "pipeline_components_pipeline_id_index" ON "pipeline_components" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipeline_triggers_pipeline_id_index" ON "pipeline_triggers" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipelines_owner_user_id_index" ON "pipelines" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");