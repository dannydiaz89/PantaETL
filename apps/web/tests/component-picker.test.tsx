import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentMetadata } from "@pantaetl/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ComponentPicker,
  ComponentPickerConfiguration,
  filterComponentCapabilities,
} from "../src/components/pipeline/component-picker.js";
import { componentCapabilityQueryKeys } from "../src/data/components/index.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { createI18n } from "../src/locales/index.js";
import { en } from "../src/locales/en.js";

describe("ComponentPicker", () => {
  it("renders localized utility-style component options with accessible disabled reasons", () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider>
        <ComponentPicker
          capabilities={[source, transform]}
          getOptionState={(component) => component.type === transform.type
            ? { disabled: true, reason: "This transform cannot receive the selected dataset." }
            : { disabled: false, reason: undefined }}
          kind="transform"
          onSelect={() => undefined}
          selected={transform}
        />
      </LocaleProvider>,
    );

    expect(markup).toContain(en["component.picker.searchLabel"]);
    expect(markup).toContain(en["components.transforms.rows.limit.name"]);
    expect(markup).toContain(en["components.transforms.rows.limit.description"]);
    expect(markup).toContain("This transform cannot receive the selected dataset.");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("disabled=\"\"");
  });

  it("filters translated name and description text without a hardcoded component catalog", () => {
    const { t } = createI18n("en-US");

    expect(filterComponentCapabilities([source, transform], "limit", t)).toEqual([transform]);
    expect(filterComponentCapabilities([source, transform], "read a csv", t)).toEqual([source]);
    expect(filterComponentCapabilities([source, transform], "missing", t)).toEqual([]);
  });

  it("renders the selected component's generic configuration controls from capability query data", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(componentCapabilityQueryKeys.list({ kind: "source" }), { components: [source] });
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <ComponentPickerConfiguration
            kind="source"
            onSelect={() => undefined}
            onValuesChange={() => undefined}
            selected={source}
            values={{ sourcePath: "imports/orders.csv" }}
          />
        </LocaleProvider>
      </QueryClientProvider>,
    );

    expect(markup).toContain(en["components.sources.csv.sourcePath"]);
    expect(markup).toContain("imports/orders.csv");
  });
});

const source: ComponentMetadata = {
  configFields: [
    { key: "sourcePath", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" },
  ],
  descriptionKey: "components.sources.csv.description",
  displayNameKey: "components.sources.csv.name",
  inputFamilies: [],
  kind: "source",
  outputFamilies: ["tabular"],
  type: "source.csv",
  version: "v1",
};

const transform: ComponentMetadata = {
  configFields: [
    { key: "count", labelKey: "components.transforms.rows.limit.count", required: true, secret: false, type: "number" },
  ],
  descriptionKey: "components.transforms.rows.limit.description",
  displayNameKey: "components.transforms.rows.limit.name",
  inputFamilies: ["tabular"],
  kind: "transform",
  outputFamilies: ["tabular"],
  type: "transform.limit",
  version: "v1",
};
