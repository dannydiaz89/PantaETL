CREATE TABLE "run_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"level" text NOT NULL,
	"event" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '1 year' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"run_step_id" uuid NOT NULL,
	"family" text NOT NULL,
	"format" text NOT NULL,
	"storage_kind" "artifact_storage_kind" NOT NULL,
	"storage_location" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"encrypted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "source_checkpoints" (
	"pipeline_id" uuid NOT NULL,
	"source_component_id" uuid NOT NULL,
	"checkpoint" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_checkpoints_primary_key" PRIMARY KEY("pipeline_id","source_component_id")
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() + interval '30 days' NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() + interval '1 year' NOT NULL;--> statement-breakpoint
ALTER TABLE "run_logs" ADD CONSTRAINT "run_logs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_run_step_id_run_steps_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."run_steps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_checkpoints" ADD CONSTRAINT "source_checkpoints_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_checkpoints" ADD CONSTRAINT "source_checkpoints_source_component_foreign_key" FOREIGN KEY ("pipeline_id","source_component_id") REFERENCES "public"."pipeline_components"("pipeline_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_logs_expiry_index" ON "run_logs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "run_logs_run_id_index" ON "run_logs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "datasets_expiry_index" ON "datasets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "datasets_run_id_index" ON "datasets" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "artifacts_expiry_index" ON "artifacts" USING btree ("expires_at");