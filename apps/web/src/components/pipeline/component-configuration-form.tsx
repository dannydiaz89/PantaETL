import { useEffect, useState } from "react";

import type { ComponentConfiguration, ComponentMetadata, ConfigField } from "@pantaetl/contracts";
import { Checkbox, Field, Input, Select, Textarea } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import type { TranslationKey } from "../../locales/en.js";
import { ComponentSourceFileField } from "./component-source-file-field.js";

type ConfigurationValues = ComponentConfiguration["values"];
type ConfigurationValue = ConfigurationValues[string];

/** Props for the metadata-driven component configuration renderer. */
export interface ComponentConfigurationFormProps {
  /** Prevents modifications while retaining visible non-secret configuration. */
  readonly disabled?: boolean;
  /** Server or draft validation errors keyed by metadata field key. */
  readonly errors?: Readonly<Record<string, string | undefined>>;
  /** Metadata that defines the generic controls and their localized labels. */
  readonly metadata: ComponentMetadata;
  /** Receives only metadata-declared non-secret JSON values. */
  readonly onChange: (values: ConfigurationValues) => void;
  /** Current non-secret draft values for this component. */
  readonly values: ConfigurationValues;
}

/** Renders configuration controls from component metadata without component-type-specific UI branches. */
export function ComponentConfigurationForm({
  disabled = false,
  errors = {},
  metadata,
  onChange,
  values,
}: ComponentConfigurationFormProps) {
  const { t } = useI18n();
  const visibleValues = sanitizeNonSecretConfigurationValues(metadata, values);

  function updateValue(key: string, value: ConfigurationValue | undefined): void {
    const nextValues = Object.fromEntries(
      Object.entries(visibleValues).filter(([existingKey]) => existingKey !== key),
    ) as Record<string, ConfigurationValue>;
    if (value !== undefined) nextValues[key] = value;
    onChange(sanitizeNonSecretConfigurationValues(metadata, nextValues));
  }

  return (
    <div className="component-configuration-form">
      {metadata.configFields.filter((field) => !field.secret).map((field) => (
        <div
          className={`component-configuration-form__field component-configuration-form__field--${configFieldWidth(field)}`}
          key={field.key}
        >
          <ConfigurationField
            disabled={disabled}
            error={errors[field.key]}
            field={field}
            onChange={(value) => updateValue(field.key, value)}
            t={t}
            value={visibleValues[field.key]}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Resolves how much horizontal room one control should occupy.
 *
 * A component may declare the width its value actually needs, so a
 * single-character separator does not claim as much room as a file path.
 * Without a declaration the control type is the only honest signal, so
 * free-form multi-line values take a full row and everything else takes a
 * readable single-line width.
 */
function configFieldWidth(field: ConfigField): "short" | "medium" | "full" {
  if (field.width !== undefined) return field.width;
  return field.type === "textarea" || field.type === "json" ? "full" : "medium";
}

/** Render one supported metadata field type through the shared design-system controls. */
function ConfigurationField({
  disabled,
  error,
  field,
  onChange,
  t,
  value,
}: {
  readonly disabled: boolean;
  readonly error: string | undefined;
  readonly field: ConfigField;
  readonly onChange: (value: ConfigurationValue | undefined) => void;
  readonly t: (key: TranslationKey) => string;
  readonly value: ConfigurationValue | undefined;
}) {
  const label = translateMetadataKey(t, field.labelKey);
  const description = field.descriptionKey === undefined
    ? undefined
    : translateMetadataKey(t, field.descriptionKey);

  if (field.type === "boolean") {
    return (
      <Checkbox
        checked={value === undefined ? field.defaultValue === true : value === true}
        description={description}
        disabled={disabled}
        label={label}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
    );
  }

  return (
    <Field description={description} error={error} label={label} required={field.required}>
      {({ describedBy, id, invalid }) => renderFieldControl({
        describedBy,
        disabled,
        field,
        id,
        invalid,
        onChange,
        t,
        value,
      })}
    </Field>
  );
}

/** Render a supported primitive control while converting browser input to safe JSON values. */
function renderFieldControl({
  describedBy,
  disabled,
  field,
  id,
  invalid,
  onChange,
  t,
  value,
}: {
  readonly describedBy: string | undefined;
  readonly disabled: boolean;
  readonly field: Exclude<ConfigField, { readonly type: "boolean" }>;
  readonly id: string;
  readonly invalid: boolean;
  readonly onChange: (value: ConfigurationValue | undefined) => void;
  readonly t: (key: TranslationKey) => string;
  readonly value: ConfigurationValue | undefined;
}) {
  switch (field.type) {
    case "number":
      return (
        <Input
          aria-describedby={describedBy}
          aria-invalid={invalid}
          disabled={disabled}
          id={id}
          inputMode="decimal"
          onChange={(event) => {
            const nextValue = event.target.value;
            if (nextValue.length === 0) {
              onChange(undefined);
              return;
            }

            const parsed = Number(nextValue);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          placeholder={unsetValuePlaceholder(field, t)}
          required={field.required}
          type="number"
          value={typeof value === "number" ? value : ""}
        />
      );
    case "select":
      return (
        <Select
          aria-describedby={describedBy}
          aria-invalid={invalid}
          disabled={disabled}
          id={id}
          onValueChange={(nextValue) => onChange(nextValue)}
          options={(field.options ?? []).map((option) => ({
            label: translateMetadataKey(t, option.labelKey),
            value: option.value,
          }))}
          placeholder={defaultOptionLabel(field, t) ?? t("component.form.selectPlaceholder")}
          value={typeof value === "string" ? value : undefined}
        />
      );
    case "json":
      return (
        <JsonConfigurationInput
          describedBy={describedBy}
          disabled={disabled}
          field={field}
          id={id}
          invalid={invalid}
          onChange={onChange}
          t={t}
          value={value}
        />
      );
    case "textarea":
      return (
        <Textarea
          aria-describedby={describedBy}
          aria-invalid={invalid}
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(optionalStringValue(event.target.value))}
          placeholder={unsetValuePlaceholder(field, t)}
          required={field.required}
          value={typeof value === "string" ? value : ""}
        />
      );
    case "file":
      return (
        <ComponentSourceFileField
          describedBy={describedBy}
          disabled={disabled}
          id={id}
          invalid={invalid}
          onChange={(nextValue) => onChange(nextValue)}
          placeholder={unsetValuePlaceholder(field, t)}
          required={field.required}
          value={typeof value === "string" ? value : ""}
        />
      );
    case "text":
      return (
        <Input
          aria-describedby={describedBy}
          aria-invalid={invalid}
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(optionalStringValue(event.target.value))}
          placeholder={unsetValuePlaceholder(field, t)}
          required={field.required}
          value={typeof value === "string" ? value : ""}
        />
      );
  }
}

/**
 * Shows what belongs in an empty control.
 *
 * A declared example takes precedence, because a field whose value has a shape
 * is far easier to fill in from a well-formed sample than from prose. Otherwise
 * a declared default is surfaced, since the executing component applies it when
 * the field is left alone and the form should not imply that nothing happens.
 * Returns undefined when a component declares neither, leaving the control
 * genuinely empty.
 */
function unsetValuePlaceholder(field: ConfigField, t: (key: TranslationKey) => string): string | undefined {
  if (field.placeholderKey !== undefined) return translateMetadataKey(t, field.placeholderKey);
  return field.defaultValue === undefined ? undefined : String(field.defaultValue);
}

/** Names the option a select falls back to, so its resting state is not blank when a default exists. */
function defaultOptionLabel(field: ConfigField, t: (key: TranslationKey) => string): string | undefined {
  const defaultOption = (field.options ?? []).find((option) => option.value === field.defaultValue);
  return defaultOption === undefined ? undefined : translateMetadataKey(t, defaultOption.labelKey);
}

/** Keeps unparsed JSON input local until it is valid enough to enter portable configuration values. */
function JsonConfigurationInput({
  describedBy,
  disabled,
  field,
  id,
  invalid,
  onChange,
  t,
  value,
}: {
  readonly describedBy: string | undefined;
  readonly disabled: boolean;
  readonly field: ConfigField;
  readonly id: string;
  readonly invalid: boolean;
  readonly onChange: (value: ConfigurationValue | undefined) => void;
  readonly t: (key: TranslationKey) => string;
  readonly value: ConfigurationValue | undefined;
}) {
  const [rawValue, setRawValue] = useState(() => serializeJsonValue(value));
  const [jsonError, setJsonError] = useState<string | undefined>();

  useEffect(() => {
    setRawValue(serializeJsonValue(value));
  }, [value]);

  function changeJson(nextRawValue: string): void {
    setRawValue(nextRawValue);
    if (nextRawValue.trim().length === 0) {
      setJsonError(undefined);
      onChange(undefined);
      return;
    }

    const parsed = parseJsonConfigurationValue(nextRawValue);
    if (parsed === undefined) {
      setJsonError("invalid");
      return;
    }

    setJsonError(undefined);
    onChange(parsed);
  }

  return (
    <>
      <Textarea
        aria-describedby={jsonError === undefined ? describedBy : `${describedBy ?? ""} ${id}-json-error`.trim()}
        aria-invalid={invalid || jsonError !== undefined}
        disabled={disabled}
        id={id}
        onChange={(event) => changeJson(event.target.value)}
        placeholder={unsetValuePlaceholder(field, t)}
        required={field.required}
        value={rawValue}
      />
      {jsonError === undefined ? null : <p className="ui-field__error" id={`${id}-json-error`} role="alert">{t("component.form.invalidJson")}</p>}
    </>
  );
}

/** Drop any secret or undeclared key before values leave the generic renderer. */
export function sanitizeNonSecretConfigurationValues(
  metadata: ComponentMetadata,
  values: ConfigurationValues,
): ConfigurationValues {
  const permittedKeys = new Set(metadata.configFields.filter((field) => !field.secret).map((field) => field.key));
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => permittedKeys.has(key)),
  ) as ConfigurationValues;
}

/** Parse JSON only when it fits the portable component configuration value domain. */
export function parseJsonConfigurationValue(value: string): ConfigurationValue | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return isConfigurationValue(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Use undefined for a blank optional string so configuration stays concise and portable. */
function optionalStringValue(value: string): string | undefined {
  return value.length === 0 ? undefined : value;
}

/** Serialize a valid JSON configuration value for an editable textarea. */
function serializeJsonValue(value: ConfigurationValue | undefined): string {
  return value === undefined ? "" : JSON.stringify(value, undefined, 2);
}

/** Recursively constrain parsed JSON to the canonical portable configuration value space. */
function isConfigurationValue(value: unknown): value is ConfigurationValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isConfigurationValue);
  return typeof value === "object" && value !== null
    && Object.values(value).every(isConfigurationValue);
}

/** Resolve component metadata keys through the typed locale catalog. */
function translateMetadataKey(t: (key: TranslationKey) => string, key: string): string {
  return t(key as TranslationKey);
}
