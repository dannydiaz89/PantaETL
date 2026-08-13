import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { artifacts } from "../src/schema/artifacts.js";
import { runLogs, runs } from "../src/schema/execution.js";
import { datasets, sourceCheckpoints } from "../src/schema/retention.js";
import { pipelineComponents, pipelines } from "../src/schema/pipelines.js";

describe("checkpoint and retention schema", () => {
  it("ties each Source checkpoint to a component within its pipeline", () => {
    const config = getTableConfig(sourceCheckpoints);
    const sourceForeignKey = config.foreignKeys.find(
      (foreignKey) => foreignKey.getName() === "source_checkpoints_source_component_foreign_key",
    );

    expect(sourceCheckpoints.checkpoint.getSQLType()).toBe("jsonb");
    expect(sourceCheckpoints.pipelineId.notNull).toBe(true);
    expect(sourceCheckpoints.sourceComponentId.notNull).toBe(true);
    expect(sourceForeignKey?.reference().foreignTable).toBe(pipelineComponents);
    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      "pipeline_id",
      "source_component_id",
    ]);
    expect(getTableConfig(sourceCheckpoints).foreignKeys.some(
      (foreignKey) => foreignKey.reference().foreignTable === pipelines,
    )).toBe(true);
  });

  it("exposes explicit expiry metadata for temporary datasets", () => {
    const config = getTableConfig(datasets);

    expect(datasets.expiresAt.getSQLType()).toBe("timestamp with time zone");
    expect(datasets.encrypted.default).toBe(true);
    expect(config.indexes.map((index) => index.config.name)).toContain("datasets_expiry_index");
  });

  it("assigns expiration metadata to retained artifacts, runs, and logs", () => {
    expect(artifacts.expiresAt.notNull).toBe(true);
    expect(runs.expiresAt.notNull).toBe(true);
    expect(runLogs.expiresAt.notNull).toBe(true);
    expect(getTableConfig(artifacts).indexes.map((index) => index.config.name)).toContain("artifacts_expiry_index");
    expect(getTableConfig(runLogs).indexes.map((index) => index.config.name)).toContain("run_logs_expiry_index");
  });
});
