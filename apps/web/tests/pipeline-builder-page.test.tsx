import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PipelineBuilderPage } from "../src/components/pipeline-builder-page.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { en } from "../src/locales/en.js";

describe("PipelineBuilderPage", () => {
  it("shows an accessible loading state before hydration determines whether a draft is being resumed", () => {
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <LocaleProvider><PipelineBuilderPage /></LocaleProvider>
      </QueryClientProvider>,
    );

    expect(markup).toContain(en["pipeline.builder.resume.loading"]);
    expect(markup).toContain('role="status"');
  });
});
