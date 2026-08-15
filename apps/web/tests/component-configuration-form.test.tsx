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

  it("gives each control the width its metadata declares", () => {
    const markup = renderMetadata(presentationMetadata, {});

    expect(markup).toContain("component-configuration-form__field--short");
    expect(markup).toContain("component-configuration-form__field--full");
  });

  it("falls back to a readable width when metadata declares none", () => {
    const markup = renderMetadata(allFieldTypesMetadata, {});

    expect(markup).toContain("component-configuration-form__field--medium");
    expect(markup).toContain("component-configuration-form__field--full");
    expect(markup).not.toContain("component-configuration-form__field--short");
  });

  it("shows an untouched control in the state the component will execute with", () => {
    const markup = renderMetadata(presentationMetadata, {});

    expect(markup).toContain('data-state="checked"');
    expect(markup).toContain('placeholder=","');
  });

  it("lets an explicit false override a declared true default", () => {
    const markup = renderMetadata(presentationMetadata, { hasHeader: false });

    expect(markup).toContain('data-state="unchecked"');
    expect(markup).not.toContain('data-state="checked"');
  });

  it("offers to supply the file a declared file field names, without replacing the path", () => {
    const markup = renderMetadata(presentationMetadata, { sourcePath: "uploads/orders.csv" });

    expect(markup).toContain(en["component.form.upload.action"]);
    expect(markup).toContain('value="uploads/orders.csv"');
    expect(markup).toContain('type="file"');
  });

  it("demonstrates the shape a structured field expects", () => {
    const rename = builtInComponentCapabilities.find((component) => component.type === "transform.columns.rename");
    const markup = renderMetadata(rename as ComponentMetadata, {});

    expect(markup).toContain(en["components.transforms.columns.rename.renamesExample"]
      .replaceAll("&", "&amp;").replaceAll('"', "&quot;"));
    expect(markup).toContain(en["components.transforms.columns.rename.renamesDescription"]);
  });

  it("prefers a declared example over a declared default", () => {
    const markup = renderMetadata({
      ...presentationMetadata,
      configFields: [{
        defaultValue: ",",
        key: "separator",
        labelKey: "components.sources.csv.separator",
        placeholderKey: "components.sources.csv.sourcePath",
        required: false,
        secret: false,
        type: "text",
      }],
    }, {});

    expect(markup).toContain(`placeholder="${en["components.sources.csv.sourcePath"]}"`);
    expect(markup).not.toContain('placeholder=","');
  });

  it("leaves a field with neither an example nor a default genuinely empty", () => {
    const markup = renderMetadata(allFieldTypesMetadata, {});

    // The leading space distinguishes a real placeholder from the select's own data-placeholder.
    expect(markup).not.toContain(' placeholder="');
  });

  it("gives every configurable field of every built-in component some guidance", () => {
    const undocumented = builtInComponentCapabilities.flatMap((component) =>
      component.configFields
        .filter((field) => !field.secret && field.descriptionKey === undefined)
        .map((field) => `${component.type}.${field.key}`));

    expect(undocumented).toEqual([]);
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

/** Renders one metadata document with the locale provider the controls expect. */
function renderMetadata(metadata: ComponentMetadata, values: Record<string, string | number | boolean>): string {
  return renderToStaticMarkup(
    <LocaleProvider>
      <ComponentConfigurationForm metadata={metadata} onChange={() => undefined} values={values} />
    </LocaleProvider>,
  );
}

const presentationMetadata: ComponentMetadata = {
  configFields: [
    {
      key: "sourcePath",
      labelKey: "components.sources.csv.sourcePath",
      required: true,
      secret: false,
      type: "file",
      width: "full",
    },
    {
      defaultValue: true,
      key: "hasHeader",
      labelKey: "components.sources.csv.hasHeader",
      required: false,
      secret: false,
      type: "boolean",
      width: "full",
    },
    {
      defaultValue: ",",
      key: "separator",
      labelKey: "components.sources.csv.separator",
      required: false,
      secret: false,
      type: "text",
      width: "short",
    },
  ],
  descriptionKey: "components.sources.csv.description",
  displayNameKey: "components.sources.csv.name",
  inputFamilies: [],
  kind: "source",
  outputFamilies: ["tabular"],
  type: "source.presentation-test",
  version: "v1",
};

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
