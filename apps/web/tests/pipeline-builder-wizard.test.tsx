import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createEmptyPipelineBuilderDraft, updatePipelineBuilderDraft } from "../src/components/pipeline/pipeline-builder-draft.js";
import { PipelineBuilderWizard } from "../src/components/pipeline/pipeline-builder-wizard.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { en } from "../src/locales/en.js";

describe("PipelineBuilderWizard", () => {
  it("renders exactly three numbered stages plus a name field that is not a fourth stage", () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider><PipelineBuilderWizard /></LocaleProvider>,
    );

    expect(markup).toContain(en["pipeline.name"]);
    expect(markup).toContain(en["pipeline.builder.step.source.label"]);
    expect(markup).toContain(en["pipeline.builder.step.transforms.label"]);
    expect(markup).toContain(en["pipeline.builder.step.export.label"]);

    const stepItemCount = markup.split("pipeline-builder__step ").length - 1;
    expect(stepItemCount).toBe(3);
  });

  it("marks the active stage with a non-color-only accessible current-step indicator", () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider><PipelineBuilderWizard /></LocaleProvider>,
    );

    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain(en["pipeline.builder.status.current"]);
    expect(markup).toContain(en["pipeline.builder.status.upcoming"]);
  });

  it("shows a completed status for stages before the active one", () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider><PipelineBuilderWizard initialStep="export" /></LocaleProvider>,
    );

    expect(markup).toContain(en["pipeline.builder.status.completed"]);
  });

  it("hides Back on the first stage and hides Next on the last stage", () => {
    const firstStepMarkup = renderToStaticMarkup(
      <LocaleProvider><PipelineBuilderWizard /></LocaleProvider>,
    );
    expect(firstStepMarkup).not.toContain(en["pipeline.builder.back"]);
    expect(firstStepMarkup).toContain(en["pipeline.builder.next"]);

    const lastStepMarkup = renderToStaticMarkup(
      <LocaleProvider><PipelineBuilderWizard initialStep="export" /></LocaleProvider>,
    );
    expect(lastStepMarkup).toContain(en["pipeline.builder.back"]);
    expect(lastStepMarkup).not.toContain(en["pipeline.builder.next"]);
  });

  it("keeps the collected pipeline name visible regardless of the active stage, proving Back/Next preserve the draft", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), { name: "Orders sync" });

    for (const step of ["source", "transforms", "export"] as const) {
      const markup = renderToStaticMarkup(
        <LocaleProvider><PipelineBuilderWizard initialDraft={draft} initialStep={step} /></LocaleProvider>,
      );
      expect(markup).toContain('value="Orders sync"');
    }
  });

  it("uses the application design system's accessible form field for the pipeline name", () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider><PipelineBuilderWizard /></LocaleProvider>,
    );

    expect(markup).toContain("ui-field");
    expect(markup).toContain("ui-input");
  });
});
