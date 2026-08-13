CREATE TYPE "public"."operational_event_kind" AS ENUM('run_queued', 'run_started', 'run_succeeded', 'run_completed_with_warnings', 'run_failed', 'run_cancelled', 'step_queued', 'step_started', 'step_succeeded', 'step_completed_with_warnings', 'step_failed', 'step_cancelled', 'job_claimed', 'job_retried');--> statement-breakpoint
CREATE TABLE "operational_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"run_step_id" uuid,
	"job_id" uuid,
	"worker_id" uuid,
	"event" "operational_event_kind" NOT NULL,
	"records_read" integer,
	"records_written" integer,
	"bytes_read" integer,
	"bytes_written" integer,
	"duration_ms" integer,
	"retry_attempt" integer,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operational_events" ADD CONSTRAINT "operational_events_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_events" ADD CONSTRAINT "operational_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_events" ADD CONSTRAINT "operational_events_run_step_id_run_steps_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."run_steps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_events" ADD CONSTRAINT "operational_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operational_events_run_occurred_at_index" ON "operational_events" USING btree ("run_id","occurred_at");--> statement-breakpoint
CREATE INDEX "operational_events_step_occurred_at_index" ON "operational_events" USING btree ("run_step_id","occurred_at");--> statement-breakpoint
CREATE INDEX "operational_events_job_occurred_at_index" ON "operational_events" USING btree ("job_id","occurred_at");