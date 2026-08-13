import { bigint, boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { artifactStorageKind } from "./enums.js";
import { pipelines } from "./pipelines.js";
import { runs } from "./execution.js";

/** Metadata for retained output artifacts; expiration data is added separately. */
export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "restrict" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "restrict" }),
    format: text("format").notNull(),
    contentType: text("content_type"),
    fileName: text("file_name").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storageKind: artifactStorageKind("storage_kind").notNull(),
    storageLocation: text("storage_location").notNull(),
    encrypted: boolean("encrypted").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("artifacts_run_id_index").on(table.runId)],
);
