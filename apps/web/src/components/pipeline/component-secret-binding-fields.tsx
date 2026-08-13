import { useState } from "react";

import type { ComponentMetadata, SecretBinding } from "@pantaetl/contracts";
import { Button, Field, Input } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import type { TranslationKey } from "../../locales/en.js";

/** Input accepted by a server-owned write-only secret operation. */
export interface SecretReplacementRequest {
  /** Existing binding to replace when this field was already configured. */
  readonly existingBinding: string | undefined;
  /** Metadata field key that needs a secret binding. */
  readonly key: string;
  /** Newly entered plaintext for immediate write-only submission only. */
  readonly value: string;
}

/** Performs a write-only secret replacement and returns just the durable reference. */
export type SecretBindingWriter = (request: SecretReplacementRequest) => Promise<SecretBinding>;

/** Props for metadata-derived write-only secret binding controls. */
export interface ComponentSecretBindingFieldsProps {
  /** Prevents secret replacement while retaining a safe configured-state indicator. */
  readonly disabled?: boolean;
  /** Current pipeline configuration's opaque secret binding references. */
  readonly secretBindings: readonly SecretBinding[];
  /** Receives updated opaque references after successful write-only submission. */
  readonly onChange: (bindings: readonly SecretBinding[]) => void;
  /** Writes a newly entered secret outside ordinary component configuration values. */
  readonly replaceSecret: SecretBindingWriter;
  /** Metadata declaring the component's secret fields. */
  readonly metadata: ComponentMetadata;
}

/** Renders one write-only replacement control for each secret field declared in component metadata. */
export function ComponentSecretBindingFields({
  disabled = false,
  metadata,
  onChange,
  replaceSecret,
  secretBindings,
}: ComponentSecretBindingFieldsProps) {
  const secretFields = metadata.configFields.filter((field) => field.secret);
  if (secretFields.length === 0) return null;

  return (
    <div className="component-secret-binding-fields">
      {secretFields.map((field) => (
        <SecretBindingField
          binding={secretBindings.find((candidate) => candidate.key === field.key)}
          disabled={disabled}
          fieldKey={field.key}
          key={field.key}
          labelKey={field.labelKey}
          onChange={onChange}
          replaceSecret={replaceSecret}
          secretBindings={secretBindings}
        />
      ))}
    </div>
  );
}

/** Presents a safe configured state and sends new secret text directly to the write-only boundary. */
function SecretBindingField({
  binding,
  disabled,
  fieldKey,
  labelKey,
  onChange,
  replaceSecret,
  secretBindings,
}: {
  readonly binding: SecretBinding | undefined;
  readonly disabled: boolean;
  readonly fieldKey: string;
  readonly labelKey: string;
  readonly onChange: (bindings: readonly SecretBinding[]) => void;
  readonly replaceSecret: SecretBindingWriter;
  readonly secretBindings: readonly SecretBinding[];
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setSaving] = useState(false);

  async function submit(): Promise<void> {
    if (value.length === 0 || disabled || isSaving) {
      if (value.length === 0) setError(t("component.secret.required"));
      return;
    }

    setError(undefined);
    setSaving(true);
    try {
      const nextBinding = await replaceSecret({
        existingBinding: binding?.binding,
        key: fieldKey,
        value,
      });
      onChange(replaceSecretBinding(secretBindings, nextBinding));
      setValue("");
    } catch {
      setError(t("component.secret.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="component-secret-binding-field">
      <Field
        description={binding === undefined ? t("component.secret.notConfigured") : t("component.secret.configured")}
        error={error}
        label={translateMetadataKey(t, labelKey)}
        required
      >
        {({ describedBy, id, invalid }) => (
          <Input
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoComplete="new-password"
            disabled={disabled || isSaving}
            id={id}
            onChange={(event) => setValue(event.target.value)}
            type="password"
            value={value}
          />
        )}
      </Field>
      <Button disabled={disabled || isSaving} onClick={() => { void submit(); }} type="button" variant="secondary">
        {isSaving ? t("component.secret.saving") : binding === undefined ? t("component.secret.save") : t("component.secret.replace")}
      </Button>
    </div>
  );
}

/** Replace one field's opaque secret reference while preserving all untouched field bindings. */
export function replaceSecretBinding(
  bindings: readonly SecretBinding[],
  replacement: SecretBinding,
): readonly SecretBinding[] {
  return [
    ...bindings.filter((binding) => binding.key !== replacement.key),
    replacement,
  ];
}

/** Resolve component metadata keys through the typed locale catalog. */
function translateMetadataKey(t: (key: TranslationKey) => string, key: string): string {
  return t(key as TranslationKey);
}
