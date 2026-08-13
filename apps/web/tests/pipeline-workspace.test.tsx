import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PipelineWorkspace } from "../src/components/pipeline-workspace.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { en } from "../src/locales/en.js";

describe("PipelineWorkspace", () => {
  it("composes the fixture library and localized editor panels", () => {
    const markup = renderToStaticMarkup(<LocaleProvider><PipelineWorkspace /></LocaleProvider>);

    expect(markup).toContain(en["pipeline.list.title"]);
    expect(markup).toContain(en["pipeline.editor.title"]);
    expect(markup).toContain(en["pipeline.fixture.daily"]);
    expect(markup).toContain(en["pipeline.fixture.customers"]);
    expect(markup).toContain(en["pipeline.locked.title"]);
    expect(markup).toContain(en["pipeline.table.caption"]);
  });
});
