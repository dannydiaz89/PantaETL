import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentMetadata } from "@pantaetl/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createEmptyPipelineBuilderDraft, setPipelineBuilderSource, setPipelineBuilderSourceValues, updatePipelineBuilderDraft, type PipelineBuilderDraft, type PipelineBuilderStep } from "../src/components/pipeline/pipeline-builder-draft.js";
import { PipelineBuilderWizard } from "../src/components/pipeline/pipeline-builder-wizard.js";
import { componentCapabilityQueryKeys } from "../src/data/components/index.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { en } from "../src/locales/en.js";

/** Renders the wizard with capability data preseeded so the Source step's picker never issues a network request. */
function renderWizard(props: { readonly initialDraft?: PipelineBuilderDraft; readonly initialStep?: PipelineBuilderStep } = {}): string {
  const queryClient = new QueryClient();
  queryClient.setQueryData(componentCapabilityQueryKeys.list({ kind: "source" }), { components: [csvSource, restSource] });

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider><PipelineBuilderWizard {...props} /></LocaleProvider>
    </QueryClientProvider>,
  );
}

describe("PipelineBuilderWizard", () => {
  it("renders exactly three numbered stages plus a name field that is not a fourth stage", () => {
    const markup = renderWizard();

    expect(markup).toContain(en["pipeline.name"]);
    expect(markup).toContain(en["pipeline.builder.step.source.label"]);
    expect(markup).toContain(en["pipeline.builder.step.transforms.label"]);
    expect(markup).toContain(en["pipeline.builder.step.export.label"]);

    const stepItemCount = markup.split("pipeline-builder__step ").length - 1;
    expect(stepItemCount).toBe(3);
  });

  it("marks the active stage with a non-color-only accessible current-step indicator", () => {
    const markup = renderWizard();

    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain(en["pipeline.builder.status.current"]);
    expect(markup).toContain(en["pipeline.builder.status.upcoming"]);
  });

  it("shows a completed status for stages before the active one", () => {
    const markup = renderWizard({ initialStep: "export" });

    expect(markup).toContain(en["pipeline.builder.status.completed"]);
  });

  it("hides Back on the first stage and hides Next on the last stage", () => {
    const firstStepMarkup = renderWizard();
    expect(firstStepMarkup).not.toContain(en["pipeline.builder.back"]);
    expect(firstStepMarkup).toContain(en["pipeline.builder.next"]);

    const lastStepMarkup = renderWizard({ initialStep: "export" });
    expect(lastStepMarkup).toContain(en["pipeline.builder.back"]);
    expect(lastStepMarkup).not.toContain(en["pipeline.builder.next"]);
  });

  it("keeps the collected pipeline name visible regardless of the active stage, proving Back/Next preserve the draft", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), { name: "Orders sync" });

    for (const step of ["source", "transforms", "export"] as const) {
      const markup = renderWizard({ initialDraft: draft, initialStep: step });
      expect(markup).toContain('value="Orders sync"');
    }
  });

  it("uses the application design system's accessible form field for the pipeline name", () => {
    const markup = renderWizard();

    expect(markup).toContain("ui-field");
    expect(markup).toContain("ui-input");
  });

  it("lists available Source capabilities from the capability catalog without a hardcoded component list", () => {
    const markup = renderWizard();

    expect(markup).toContain(en["components.sources.csv.name"]);
    expect(markup).toContain(en["components.sources.rest.name"]);
  });

  it("renders the selected Source's metadata-driven configuration with its saved values", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = setPipelineBuilderSource(draft, csvSource, () => "source-id");
    draft = setPipelineBuilderSourceValues(draft, { path: "orders.csv" });

    const markup = renderWizard({ initialDraft: draft });

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain(en["components.sources.csv.sourcePath"]);
    expect(markup).toContain("orders.csv");
  });
});

const csvSource: ComponentMetadata = {
  configFields: [{ key: "path", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" }],
  descriptionKey: "components.sources.csv.description",
  displayNameKey: "components.sources.csv.name",
  inputFamilies: [],
  kind: "source",
  outputFamilies: ["tabular"],
  type: "source.csv",
  version: "v1",
};

const restSource: ComponentMetadata = {
  configFields: [{ key: "url", labelKey: "components.sources.rest.url", required: true, secret: false, type: "text" }],
  descriptionKey: "components.sources.rest.description",
  displayNameKey: "components.sources.rest.name",
  inputFamilies: [],
  kind: "source",
  outputFamilies: ["document"],
  type: "source.rest-api",
  version: "v1",
};
