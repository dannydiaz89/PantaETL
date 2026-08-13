import type { ComponentMetadata, SecretBinding } from "@pantaetl/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ComponentSecretBindingFields,
  replaceSecretBinding,
} from "../src/components/pipeline/component-secret-binding-fields.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { en } from "../src/locales/en.js";

describe("ComponentSecretBindingFields", () => {
  it("renders a write-only replacement input and only a safe configured-state indicator", () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider>
        <ComponentSecretBindingFields
          metadata={metadata}
          onChange={() => undefined}
          replaceSecret={async () => ({ binding: "new-reference", key: "apiToken" })}
          secretBindings={[{ binding: "existing-reference", key: "apiToken" }]}
        />
      </LocaleProvider>,
    );

    expect(markup).toContain('type="password"');
    expect(markup).toContain(en["component.secret.configured"]);
    expect(markup).not.toContain("existing-reference");
    expect(markup).not.toContain("usable-secret");
  });

  it("replaces only one opaque reference and preserves untouched secret bindings", () => {
    const existing: readonly SecretBinding[] = [
      { binding: "orders-api", key: "apiToken" },
      { binding: "warehouse", key: "warehousePassword" },
    ];

    expect(replaceSecretBinding(existing, { binding: "orders-api-next", key: "apiToken" })).toEqual([
      { binding: "warehouse", key: "warehousePassword" },
      { binding: "orders-api-next", key: "apiToken" },
    ]);
  });
});

const metadata: ComponentMetadata = {
  configFields: [
    { key: "apiToken", labelKey: "components.sources.rest.apiToken", required: true, secret: true, type: "text" },
  ],
  descriptionKey: "components.sources.rest.description",
  displayNameKey: "components.sources.rest.name",
  inputFamilies: [],
  kind: "source",
  outputFamilies: ["document"],
  type: "source.secret-test",
  version: "v1",
};
