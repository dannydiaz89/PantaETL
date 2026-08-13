import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  jsonb,
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { componentKind, pipelineState, triggerType } from "./enums.js";
import { users } from "./users.js";

/** Pipeline definitions and their explicit owning user. */
export const pipelines = pgTable(
  "pipelines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    contractVersion: text("contract_version").default("v1").notNull(),
    name: text("name").notNull(),
    state: pipelineState("state").default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("pipelines_owner_user_id_index").on(table.ownerUserId)],
);

/** Component configuration for one node in a pipeline graph. */
export const pipelineComponents = pgTable(
  "pipeline_components",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    kind: componentKind("kind").notNull(),
    componentType: text("component_type").notNull(),
    componentVersion: text("component_version").notNull(),
    configurationValues: jsonb("configuration_values").$type<Record<string, unknown>>().notNull(),
    secretBindings: jsonb("secret_bindings")
      .$type<Record<string, string>[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
  },
  (table) => [
    index("pipeline_components_pipeline_id_index").on(table.pipelineId),
    unique("pipeline_components_pipeline_id_id_unique").on(table.pipelineId, table.id),
  ],
);

/** Directed links between component nodes in a pipeline graph. */
export const pipelineEdges = pgTable(
  "pipeline_edges",
  {
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    fromComponentId: uuid("from_component_id").notNull(),
    toComponentId: uuid("to_component_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.pipelineId, table.fromComponentId, table.toComponentId],
      name: "pipeline_edges_primary_key",
    }),
    foreignKey({
      columns: [table.pipelineId, table.fromComponentId],
      foreignColumns: [pipelineComponents.pipelineId, pipelineComponents.id],
      name: "pipeline_edges_from_component_foreign_key",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.pipelineId, table.toComponentId],
      foreignColumns: [pipelineComponents.pipelineId, pipelineComponents.id],
      name: "pipeline_edges_to_component_foreign_key",
    }).onDelete("cascade"),
  ],
);

/** Manual and schedule configurations owned by an individual pipeline. */
export const pipelineTriggers = pgTable(
  "pipeline_triggers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    type: triggerType("type").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    cron: text("cron"),
    timezone: text("timezone"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("pipeline_triggers_pipeline_id_index").on(table.pipelineId)],
);
