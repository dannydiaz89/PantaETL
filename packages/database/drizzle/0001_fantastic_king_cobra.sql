ALTER TABLE "jobs" ADD COLUMN "available_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "worker_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "jobs_eligible_work_index" ON "jobs" USING btree ("available_at","created_at") WHERE "jobs"."state" = 'queued';