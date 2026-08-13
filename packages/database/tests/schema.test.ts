import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  artifacts,
  jobs,
  pipelineComponents,
  pipelines,
  pipelineTriggers,
  runSteps,
  runs,
  settings,
  users,
} from "../src/schema/index.js";

describe("core control-plane schema", () => {
  it("exports each durable control-plane table", () => {
    expect([
      users,
      pipelines,
      pipelineComponents,
      pipelineTriggers,
      runs,
      runSteps,
      jobs,
      artifacts,
      settings,
    ]).toHaveLength(9);
  });

  it("requires every pipeline to have an explicitly owned user", () => {
    const ownerForeignKey = getTableConfig(pipelines).foreignKeys.find(
      (foreignKey) => foreignKey.getName() === "pipelines_owner_user_id_users_id_fk",
    );

    expect(pipelines.ownerUserId.notNull).toBe(true);
    expect(ownerForeignKey?.onDelete).toBe("restrict");
    expect(ownerForeignKey?.reference().foreignTable).toBe(users);
  });

  it("stores component values separately from secret binding references", () => {
    expect(pipelineComponents.configurationValues.getSQLType()).toBe("jsonb");
    expect(pipelineComponents.secretBindings.getSQLType()).toBe("jsonb");
    expect(Object.keys(pipelineComponents)).not.toContain("secretValue");
  });

  it("indexes and constrains schedule triggers for safe due-work claims", () => {
    const configuration = getTableConfig(pipelineTriggers);
    const dueScheduleIndex = configuration.indexes.find(
      (index) => index.config.name === "pipeline_triggers_due_schedule_index",
    );
    const scheduleFieldsCheck = configuration.checks.find(
      (constraint) => constraint.name === "pipeline_triggers_schedule_fields_check",
    );

    expect(pipelineTriggers.nextRunAt.notNull).toBe(false);
    expect(pipelineTriggers.lastClaimedAt.notNull).toBe(false);
    expect(dueScheduleIndex?.config.where?.queryChunks).toBeDefined();
    expect(scheduleFieldsCheck).toBeDefined();
  });

  it("allows one active queued or running run per pipeline", () => {
    const activeRunIndex = getTableConfig(runs).indexes.find(
      (index) => index.config.name === "runs_one_active_pipeline_index",
    );

    expect(runs.isActive.notNull).toBe(true);
    expect(activeRunIndex?.config.where?.queryChunks).toBeDefined();
  });
});
