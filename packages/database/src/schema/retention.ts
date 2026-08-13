import {
  bigint,
  boolean,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { artifactStorageKind } from "./enums.js";
import { runSteps, runs } from "./execution.js";
import { pipelineComponents, pipelines } from "./pipelines.js";
import { users } from "./users.js";

/**
 * The latest committed checkpoint for a Source component in one pipeline.
 *
 * Checkpoint contents are Source-defined and must advance only after the
 * corresponding pipeline run completes successfully.
 */
export const sourceCheckpoints = pgTable(
  "source_checkpoints",
  {
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    sourceComponentId: uuid("source_component_id").notNull(),
    checkpoint: jsonb("checkpoint").$type<unknown>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.pipelineId, table.sourceComponentId],
      name: "source_checkpoints_primary_key",
    }),
    foreignKey({
      columns: [table.pipelineId, table.sourceComponentId],
      foreignColumns: [pipelineComponents.pipelineId, pipelineComponents.id],
      name: "source_checkpoints_source_component_foreign_key",
    }).onDelete("cascade"),
  ],
);

/**
 * Temporary execution datasets and their explicit cleanup eligibility.
 *
 * An absent expiry means the dataset is still required by an active run; a
 * garbage collector may delete only rows whose expiry has elapsed.
 */
export const datasets = pgTable(
  "datasets",
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
    family: text("family").notNull(),
    format: text("format").notNull(),
    storageKind: artifactStorageKind("storage_kind").notNull(),
    storageLocation: text("storage_location").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    encrypted: boolean("encrypted").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("datasets_expiry_index").on(table.expiresAt),
    index("datasets_run_id_index").on(table.runId),
  ],
);

/**
 * A file uploaded to internal storage before a pipeline configuration owns it.
 *
 * Uploads are cleanup candidates only through their durable owner and explicit
 * expiry metadata. Garbage collection must never infer them from file names.
 */
export const stagedUploads = pgTable(
  "uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    storageKind: artifactStorageKind("storage_kind").notNull(),
    storageLocation: text("storage_location").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("uploads_expiry_index").on(table.expiresAt),
    index("uploads_owner_user_id_index").on(table.ownerUserId),
  ],
);
