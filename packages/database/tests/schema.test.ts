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
});
