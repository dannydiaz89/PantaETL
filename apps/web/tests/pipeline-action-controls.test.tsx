import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { pipelineDetailRequestSchema } from "@pantaetl/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PipelineSettingsPanel } from "../src/components/pipeline/pipeline-settings-panel.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { en } from "../src/locales/en.js";

describe("pipeline action controls", () => {
  it("keeps action controls accessible and disables unavailable state changes", () => {
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <LocaleProvider><PipelineSettingsPanel editable={false} pipelineId={pipelineDetailRequestSchema.parse({ pipelineId: "833e4567-e89b-12d3-a456-426614174001" }).pipelineId} state="disabled" /></LocaleProvider>
      </QueryClientProvider>,
    );

    expect(markup).toContain(en["pipeline.actions.title"]);
    expect(markup).toContain(en["pipeline.actions.duplicate"]);
    expect(markup).toContain(en["pipeline.actions.run"]);
    expect(markup).toContain("aria-labelledby=\"pipeline-actions-title\"");
    expect(markup).toContain("disabled=\"\"");
  });
});
