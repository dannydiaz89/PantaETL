ALTER TABLE "runs" ADD COLUMN "trigger_id" uuid;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_trigger_id_pipeline_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."pipeline_triggers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "runs_one_active_pipeline_index" ON "runs" USING btree ("pipeline_id") WHERE "runs"."is_active" = true AND "runs"."state" IN ('queued', 'running');