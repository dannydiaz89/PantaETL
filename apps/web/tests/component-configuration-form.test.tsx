import {
  builtInComponentCapabilities,
  type ComponentMetadata,
} from "@pantaetl/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ComponentConfigurationForm,
  parseJsonConfigurationValue,
  sanitizeNonSecretConfigurationValues,
} from "../src/components/pipeline/component-configuration-form.js";
import { LocaleProvider } from "../src/locale-provider.js";
import { en, type TranslationKey } from "../src/locales/en.js";

describe("ComponentConfigurationForm", () => {
  it("renders every supported non-secret metadata field through localized accessible controls", () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider>
        <ComponentConfigurationForm metadata={allFieldTypesMetadata} onChange={() => undefined} values={{
          booleanValue: true,
          jsonValue: { enabled: true },
          numberValue: 12,
          selectValue: "replace",
          textValue: "daily.csv",
          textareaValue: "one field per line",
        }} />
      </LocaleProvider>,
    );

    expect(markup).toContain(en["components.exports.csv.fileName"]);
    expect(markup).toContain(en["components.sources.rest.headers"]);
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('type="number"');
    expect(markup).toContain('aria-invalid="false"');
    expect(markup).toContain("textarea");
  });

  it("removes secret and undeclared keys before configuration values leave the renderer", () => {
    expect(sanitizeNonSecretConfigurationValues(allFieldTypesMetadata, {
      apiToken: "never-exported",
      textValue: "safe",
      unknownValue: "not-defined",
    })).toEqual({ textValue: "safe" });
  });

  it("accepts only portable JSON values for JSON fields", () => {
    expect(parseJsonConfigurationValue('{"headers":{"accept":"application/json"}}')).toEqual({
      headers: { accept: "application/json" },
    });
    expect(parseJsonConfigurationValue("not json")).toBeUndefined();
  });

  it("includes every generated capability translation key in the English catalog", () => {
    const metadataKeys = builtInComponentCapabilities.flatMap((component) => [
      component.displayNameKey,
      component.descriptionKey,
      ...component.configFields.flatMap((field) => [
        field.labelKey,
        ...(field.descriptionKey === undefined ? [] : [field.descriptionKey]),
        ...(field.options ?? []).map((option) => option.labelKey),
      ]),
    ]);

    for (const key of metadataKeys) {
      expect(en[key as TranslationKey]).toEqual(expect.any(String));
    }
  });
});

const allFieldTypesMetadata: ComponentMetadata = {
  configFields: [
    { key: "textValue", labelKey: "components.exports.csv.fileName", required: true, secret: false, type: "text" },
    { key: "textareaValue", labelKey: "components.sources.postgres.query", required: false, secret: false, type: "textarea" },
    { key: "numberValue", labelKey: "components.sources.rest.maxPages", required: false, secret: false, type: "number" },
    { key: "booleanValue", labelKey: "components.sources.csv.hasHeader", required: false, secret: false, type: "boolean" },
    {
      key: "selectValue",
      labelKey: "components.exports.postgres.writeMode",
      options: [{ labelKey: "components.exports.postgres.writeMode.replace", value: "replace" }],
      required: false,
      secret: false,
      type: "select",
    },
    { key: "jsonValue", labelKey: "components.sources.rest.headers", required: false, secret: false, type: "json" },
    { key: "apiToken", labelKey: "components.sources.rest.apiToken", required: false, secret: true, type: "text" },
  ],
  descriptionKey: "components.sources.rest.description",
  displayNameKey: "components.sources.rest.name",
  inputFamilies: [],
  kind: "source",
  outputFamilies: ["document"],
  type: "source.form-test",
  version: "v1",
};
