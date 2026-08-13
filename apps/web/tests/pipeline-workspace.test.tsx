import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Pipeline } from "@pantaetl/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PipelineWorkspace } from "../src/components/pipeline-workspace.js";
import { pipelineQueryKeys } from "../src/data/pipelines/keys.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { en } from "../src/locales/en.js";

describe("PipelineWorkspace", () => {
  it("composes cached pipeline queries with localized editor panels", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(pipelineQueryKeys.list(), { pipelines: [pipeline] });
    queryClient.setQueryData(pipelineQueryKeys.detail({ pipelineId: pipeline.id }), pipeline);
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <LocaleProvider><PipelineWorkspace /></LocaleProvider>
      </QueryClientProvider>,
    );

    expect(markup).toContain(en["pipeline.list.title"]);
    expect(markup).toContain(en["pipeline.editor.title"]);
    expect(markup).toContain(pipeline.name);
    expect(markup).toContain(en["pipeline.table.caption"]);
    expect(markup).toContain('data-hydrated="true"');
  });

  it("shows a localized collection loading state before the API query resolves", () => {
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <LocaleProvider><PipelineWorkspace /></LocaleProvider>
      </QueryClientProvider>,
    );

    expect(markup).toContain(en["pipeline.table.loading"]);
    expect(markup).not.toContain(en["pipeline.editor.title"]);
  });
});

const pipeline: Pipeline = {
  contractVersion: "v1",
  createdAt: "2026-08-13T00:00:00.000Z",
  edges: [{ fromStepId: "933e4567-e89b-12d3-a456-426614174002", toStepId: "933e4567-e89b-12d3-a456-426614174003" }],
  id: "933e4567-e89b-12d3-a456-426614174001",
  name: "Persisted orders",
  ownerUserId: "933e4567-e89b-12d3-a456-426614174004",
  state: "enabled",
  steps: [
    {
      componentType: "source.csv",
      componentVersion: "v1",
      configuration: { secretBindings: [], values: { path: "orders.csv" } },
      id: "933e4567-e89b-12d3-a456-426614174002",
      kind: "source",
    },
    {
      componentType: "export.json",
      componentVersion: "v1",
      configuration: { secretBindings: [], values: { path: "orders.json" } },
      id: "933e4567-e89b-12d3-a456-426614174003",
      kind: "export",
    },
  ],
  triggers: [],
  updatedAt: "2026-08-13T00:00:00.000Z",
};
