import type { Pipeline, PipelineStep } from "@pantaetl/contracts";

import { parsePipeline } from "../../lib/pipeline-boundary.js";
import type { I18n } from "../../locales/index.js";

export const lockedPipelineId = "123e4567-e89b-12d3-a456-426614174101";

const ownerUserId = "123e4567-e89b-12d3-a456-426614174001";

/** Creates contract-validated fixture pipelines until the control-plane API is connected. */
export function createPipelineFixtures(t: I18n["t"]): Pipeline[] {
  return [
    parsePipeline({
      contractVersion: "v1",
      createdAt: "2026-08-13T00:00:00.000Z",
      edges: [
        { fromStepId: "123e4567-e89b-12d3-a456-426614174102", toStepId: "123e4567-e89b-12d3-a456-426614174103" },
        { fromStepId: "123e4567-e89b-12d3-a456-426614174103", toStepId: "123e4567-e89b-12d3-a456-426614174104" },
      ],
      id: lockedPipelineId,
      name: t("pipeline.fixture.daily"),
      ownerUserId,
      state: "enabled",
      steps: [
        fixtureStep("123e4567-e89b-12d3-a456-426614174102", "source", "csv-source", { path: "/imports/orders.csv" }),
        fixtureStep("123e4567-e89b-12d3-a456-426614174103", "transform", "normalize-orders", { format: "iso-date" }),
        fixtureStep("123e4567-e89b-12d3-a456-426614174104", "export", "postgres-export", { table: "orders" }),
      ],
      triggers: [{
        cron: "0 2 * * *",
        enabled: true,
        id: "123e4567-e89b-12d3-a456-426614174105",
        pipelineId: lockedPipelineId,
        timezone: "UTC",
        type: "schedule",
      }],
      updatedAt: "2026-08-13T00:00:00.000Z",
    }),
    parsePipeline({
      contractVersion: "v1",
      createdAt: "2026-08-12T00:00:00.000Z",
      edges: [{ fromStepId: "123e4567-e89b-12d3-a456-426614174202", toStepId: "123e4567-e89b-12d3-a456-426614174203" }],
      id: "123e4567-e89b-12d3-a456-426614174201",
      name: t("pipeline.fixture.customers"),
      ownerUserId,
      state: "draft",
      steps: [
        fixtureStep("123e4567-e89b-12d3-a456-426614174202", "source", "api-source", { endpoint: "customers" }),
        fixtureStep("123e4567-e89b-12d3-a456-426614174203", "export", "parquet-export", { location: "customers" }),
      ],
      triggers: [{
        enabled: true,
        id: "123e4567-e89b-12d3-a456-426614174204",
        pipelineId: "123e4567-e89b-12d3-a456-426614174201",
        type: "manual",
      }],
      updatedAt: "2026-08-12T00:00:00.000Z",
    }),
  ];
}

/** Creates fixture graph components without placing secret values in browser state. */
function fixtureStep(
  id: string,
  kind: PipelineStep["kind"],
  componentType: string,
  values: Record<string, string>,
): PipelineStep {
  return {
    componentType,
    componentVersion: "v1",
    configuration: { secretBindings: [], values },
    id,
    kind,
  };
}
