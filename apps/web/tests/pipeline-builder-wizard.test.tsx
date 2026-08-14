import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentMetadata, Pipeline } from "@pantaetl/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { addPipelineBuilderTransform, createEmptyPipelineBuilderDraft, setPipelineBuilderExport, setPipelineBuilderExportValues, setPipelineBuilderSource, setPipelineBuilderSourceValues, updatePipelineBuilderDraft } from "../src/components/pipeline/pipeline-builder-draft.js";
import { PipelineBuilderWizard, type PipelineBuilderWizardProps } from "../src/components/pipeline/pipeline-builder-wizard.js";
import { componentCapabilityQueryKeys } from "../src/data/components/index.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { en } from "../src/locales/en.js";

/** Renders the wizard with capability data preseeded so the Source step's picker never issues a network request. */
function renderWizard(props: Omit<PipelineBuilderWizardProps, "onDraftChange"> = {}): string {
  const queryClient = new QueryClient();
  queryClient.setQueryData(componentCapabilityQueryKeys.list({ kind: "source" }), { components: [csvSource, restSource] });
  queryClient.setQueryData(componentCapabilityQueryKeys.list({ kind: "transform" }), { components: [limitTransform, documentTransform] });
  queryClient.setQueryData(componentCapabilityQueryKeys.list({ kind: "export" }), { components: [jsonExport, documentExport] });

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

  it("communicates draft readiness in place of Next once a Source and an Export are both selected", () => {
    const incompleteMarkup = renderWizard({ initialStep: "export" });
    expect(incompleteMarkup).toContain(en["pipeline.builder.readiness.incomplete"]);
    expect(incompleteMarkup).not.toContain(en["pipeline.builder.readiness.complete"]);

    let draft = createEmptyPipelineBuilderDraft();
    draft = setPipelineBuilderSource(draft, csvSource, () => "source-id");
    draft = setPipelineBuilderExport(draft, jsonExport, () => "export-id");
    const completeMarkup = renderWizard({ initialDraft: draft, initialStep: "export" });
    expect(completeMarkup).toContain(en["pipeline.builder.readiness.complete"]);
    expect(completeMarkup).not.toContain(en["pipeline.builder.readiness.incomplete"]);
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

  it("allows zero Transforms and offers the capability catalog to add one", () => {
    const markup = renderWizard({ initialStep: "transforms" });

    expect(markup).toContain(en["pipeline.builder.transform.empty"]);
    expect(markup).toContain(en["components.transforms.rows.limit.name"]);
  });

  it("shows each added Transform with its order, configuration, and keyboard-operable reorder controls", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = addPipelineBuilderTransform(draft, limitTransform, () => "t1");

    const markup = renderWizard({ initialDraft: draft, initialStep: "transforms" });

    expect(markup).toContain(en["components.transforms.rows.limit.name"]);
    expect(markup).toContain(en["components.transforms.rows.limit.count"]);
    expect(markup).toContain(en["pipeline.builder.transform.moveUp"]);
    expect(markup).toContain(en["pipeline.builder.transform.moveDown"]);
    expect(markup).toContain(en["pipeline.builder.transform.remove"]);
  });

  it("lists available Export capabilities from the capability catalog without a hardcoded component list", () => {
    const markup = renderWizard({ initialStep: "export" });

    expect(markup).toContain(en["components.exports.json.name"]);
  });

  it("renders the selected Export's metadata-driven configuration with its saved values", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = setPipelineBuilderExport(draft, jsonExport, () => "export-id");
    draft = setPipelineBuilderExportValues(draft, { fileName: "orders.json" });

    const markup = renderWizard({ initialDraft: draft, initialStep: "export" });

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain(en["components.exports.json.fileName"]);
    expect(markup).toContain("orders.json");
  });

  it("hides the Save action when the caller provides neither onCreate nor onUpdate", () => {
    const markup = renderWizard();

    expect(markup).not.toContain(en["pipeline.builder.save"]);
  });

  it("disables Save until the draft has a name and at least one component", () => {
    const empty = renderWizard({ onCreate: async () => persistedPipeline });
    expect(empty).toContain(en["pipeline.builder.save"]);
    expect(empty).toContain("disabled=\"\"");

    let draft = createEmptyPipelineBuilderDraft();
    draft = updatePipelineBuilderDraft(draft, { name: "Orders sync" });
    draft = setPipelineBuilderSource(draft, csvSource, () => "source-id");
    const persistable = renderWizard({ initialDraft: draft, onCreate: async () => persistedPipeline });
    expect(persistable).not.toContain("disabled=\"\"");
  });

  it("disables Save and shows saving text while a save is in flight", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = updatePipelineBuilderDraft(draft, { name: "Orders sync" });
    draft = setPipelineBuilderSource(draft, csvSource, () => "source-id");

    const markup = renderWizard({ initialDraft: draft, isSaving: true, onCreate: async () => persistedPipeline });

    expect(markup).toContain(en["pipeline.builder.saving"]);
    expect(markup).toContain("disabled=\"\"");
  });

  it("shows a localized save error as an alert without losing the entered draft", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = updatePipelineBuilderDraft(draft, { name: "Orders sync" });

    const markup = renderWizard({ initialDraft: draft, onCreate: async () => persistedPipeline, saveErrorMessage: "Could not save this pipeline." });

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Could not save this pipeline.");
    expect(markup).toContain('value="Orders sync"');
  });

  it("leaves every Transform option enabled before a Source is selected", () => {
    const markup = renderWizard({ initialStep: "transforms" });

    expect(markup).not.toContain(en["pipeline.builder.compatibility.incompatible"]);
    expect(markup).not.toContain("disabled=\"\"");
  });

  it("disables only the Transform option incompatible with the selected Source, with a localized reason", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = setPipelineBuilderSource(draft, csvSource, () => "source-id");

    const markup = renderWizard({ initialDraft: draft, initialStep: "transforms" });

    expect(markup).toContain(en["components.transforms.rows.limit.name"]);
    expect(markup).toContain(en["components.transforms.document.flatten.name"]);
    expect(markup).toContain(en["pipeline.builder.compatibility.incompatible"]);
    expect(markup.split("disabled=\"\"").length - 1).toBe(1);
  });

  it("re-evaluates Export compatibility against the chain tail after a Transform changes it", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = setPipelineBuilderSource(draft, csvSource, () => "source-id");

    const beforeTransform = renderWizard({ initialDraft: draft, initialStep: "export" });
    expect(beforeTransform).toContain('aria-describedby="component-reason-export-postgres"');
    expect(beforeTransform).not.toContain('aria-describedby="component-reason-export-json"');

    draft = addPipelineBuilderTransform(draft, tabularToDocumentTransform, () => "t1");
    const afterTransform = renderWizard({ initialDraft: draft, initialStep: "export" });
    expect(afterTransform).toContain('aria-describedby="component-reason-export-json"');
    expect(afterTransform).not.toContain('aria-describedby="component-reason-export-postgres"');
  });
});

const persistedPipeline: Pipeline = {
  contractVersion: "v1",
  createdAt: "2026-08-13T00:00:00.000Z",
  edges: [],
  id: "933e4567-e89b-12d3-a456-426614174001",
  name: "Orders sync",
  ownerUserId: "933e4567-e89b-12d3-a456-426614174004",
  state: "draft",
  steps: [
    {
      componentType: "source.csv",
      componentVersion: "v1",
      configuration: { secretBindings: [], values: {} },
      id: "source-1",
      kind: "source",
    },
  ],
  triggers: [],
  updatedAt: "2026-08-13T00:00:00.000Z",
};

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

const limitTransform: ComponentMetadata = {
  configFields: [{ key: "count", labelKey: "components.transforms.rows.limit.count", required: true, secret: false, type: "number" }],
  descriptionKey: "components.transforms.rows.limit.description",
  displayNameKey: "components.transforms.rows.limit.name",
  inputFamilies: ["tabular"],
  kind: "transform",
  outputFamilies: ["tabular"],
  type: "transform.limit",
  version: "v1",
};

const jsonExport: ComponentMetadata = {
  configFields: [{ key: "fileName", labelKey: "components.exports.json.fileName", required: true, secret: false, type: "text" }],
  descriptionKey: "components.exports.json.description",
  displayNameKey: "components.exports.json.name",
  inputFamilies: ["tabular"],
  kind: "export",
  outputFamilies: [],
  type: "export.json",
  version: "v1",
};

const documentTransform: ComponentMetadata = {
  configFields: [],
  descriptionKey: "components.transforms.document.flatten.description",
  displayNameKey: "components.transforms.document.flatten.name",
  inputFamilies: ["document"],
  kind: "transform",
  outputFamilies: ["tabular"],
  type: "transform.document.flatten",
  version: "v1",
};

const tabularToDocumentTransform: ComponentMetadata = {
  configFields: [],
  descriptionKey: "components.transforms.document.flatten.description",
  displayNameKey: "components.transforms.document.flatten.name",
  inputFamilies: ["tabular"],
  kind: "transform",
  outputFamilies: ["document"],
  type: "transform.tabular-to-document",
  version: "v1",
};

const documentExport: ComponentMetadata = {
  configFields: [{ key: "connectionUrl", labelKey: "components.exports.postgres.connectionUrl", required: true, secret: true, type: "text" }],
  descriptionKey: "components.exports.postgres.description",
  displayNameKey: "components.exports.postgres.name",
  inputFamilies: ["document"],
  kind: "export",
  outputFamilies: [],
  type: "export.postgres",
  version: "v1",
};
