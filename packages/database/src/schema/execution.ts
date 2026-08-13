import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { jobState, runState, runStepState } from "./enums.js";
import { pipelineComponents, pipelines, pipelineTriggers } from "./pipelines.js";
import { users } from "./users.js";

/** Durable execution records for a pipeline invocation. */
export const runs = pgTable(
  "runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "restrict" }),
    triggerId: uuid("trigger_id").references(() => pipelineTriggers.id, { onDelete: "set null" }),
    contractVersion: text("contract_version").default("v1").notNull(),
    state: runState("state").default("queued").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .default(sql`now() + interval '1 year'`)
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancellationRequestedAt: timestamp("cancellation_requested_at", { withTimezone: true }),
    cancellationRequestedByUserId: uuid("cancellation_requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    warningCount: integer("warning_count").default(0).notNull(),
  },
  (table) => [
    index("runs_pipeline_id_created_at_index").on(table.pipelineId, table.createdAt),
    uniqueIndex("runs_one_active_pipeline_index")
      .on(table.pipelineId)
      .where(sql`${table.isActive} = true AND ${table.state} IN ('queued', 'running')`),
  ],
);

/** Safe operational log entries retained separately from the run result. */
export const runLogs = pgTable(
  "run_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "restrict" }),
    level: text("level").notNull(),
    event: text("event").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .default(sql`now() + interval '1 year'`)
      .notNull(),
  },
  (table) => [index("run_logs_expiry_index").on(table.expiresAt), index("run_logs_run_id_index").on(table.runId)],
);

/** Per-component execution state and safe operational result metadata. */
export const runSteps = pgTable(
  "run_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "restrict" }),
    componentId: uuid("component_id")
      .notNull()
      .references(() => pipelineComponents.id, { onDelete: "restrict" }),
    state: runStepState("state").default("queued").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    warningCount: integer("warning_count").default(0).notNull(),
    metrics: jsonb("metrics").$type<Record<string, number>>().default({}).notNull(),
    error: jsonb("error").$type<Record<string, unknown>>(),
  },
  (table) => [index("run_steps_run_id_index").on(table.runId)],
);

/** Durable work units with state needed for short, concurrent-safe worker claims. */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "restrict" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "restrict" }),
    runStepId: uuid("run_step_id")
      .notNull()
      .references(() => runSteps.id, { onDelete: "restrict" }),
    componentId: uuid("component_id")
      .notNull()
      .references(() => pipelineComponents.id, { onDelete: "restrict" }),
    state: jobState("state").default("queued").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    workerId: uuid("worker_id"),
    attempt: integer("attempt").default(0).notNull(),
    retryMaxAttempts: integer("retry_max_attempts").default(1).notNull(),
    retryDelaySeconds: integer("retry_delay_seconds").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("jobs_run_id_index").on(table.runId),
    index("jobs_eligible_work_index")
      .on(table.availableAt, table.createdAt)
      .where(sql`${table.state} = 'queued'`),
  ],
);
