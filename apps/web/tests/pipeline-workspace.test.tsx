import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import type { Pipeline } from "@pantaetl/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PipelineWorkspace } from "../src/components/pipeline-workspace.js";
import { pipelineQueryKeys } from "../src/data/pipelines/keys.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { en } from "../src/locales/en.js";

const rootRoute = createRootRoute();
const testRouteTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/pipelines" }),
  createRoute({ getParentRoute: () => rootRoute, path: "/pipelines/new" }),
]);

/** Renders a tree that includes router-aware links, using a minimal route tree local to this test. */
async function renderWithProviders(queryClient: QueryClient, children: React.ReactNode): Promise<string> {
  const router = createRouter({ history: createMemoryHistory({ initialEntries: ["/pipelines"] }), routeTree: testRouteTree });
  await router.load();

  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>{children}</LocaleProvider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

describe("PipelineWorkspace", () => {
  it("composes cached pipeline queries with localized editor panels", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(pipelineQueryKeys.list(), { pipelines: [pipeline] });
    queryClient.setQueryData(pipelineQueryKeys.detail({ pipelineId: pipeline.id }), pipeline);
    const markup = await renderWithProviders(queryClient, <PipelineWorkspace />);

    expect(markup).toContain(en["pipeline.list.title"]);
    expect(markup).toContain(en["pipeline.editor.title"]);
    expect(markup).toContain(pipeline.name);
    expect(markup).toContain(en["pipeline.table.caption"]);
    expect(markup).toContain('data-hydrated="true"');
  });

  it("shows a localized collection loading state before the API query resolves", async () => {
    const markup = await renderWithProviders(new QueryClient(), <PipelineWorkspace />);

    expect(markup).toContain(en["pipeline.table.loading"]);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain(en["pipeline.editor.title"]);
  });

  it("gives an empty library a localized creation path", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(pipelineQueryKeys.list(), { pipelines: [] });
    const markup = await renderWithProviders(queryClient, <PipelineWorkspace />);

    expect(markup).toContain(en["pipeline.table.empty"]);
    expect(markup).toContain(en["pipeline.table.emptyDescription"]);
    expect(markup).toContain(en["pipeline.create.open"]);
    expect(markup).toContain('href="/pipelines/new"');
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
