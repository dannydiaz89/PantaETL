import { useId, useRef, useState } from "react";

import { Button, Input } from "@pantaetl/ui";

import {
  isSourceUploadApiError,
  sourceUploadApiClient,
  type SourceUploadApiClient,
  type SourceUploadApiErrorCode,
} from "../../data/uploads/index.js";
import { useI18n } from "../../locale-provider.js";
import type { TranslationKey } from "../../locales/en.js";

const UPLOAD_ERROR_KEYS: Readonly<Record<SourceUploadApiErrorCode, TranslationKey>> = {
  invalid_response: "component.form.upload.error.unknown",
  network_error: "component.form.upload.error.network",
  unauthenticated: "component.form.upload.error.unauthenticated",
  unknown_error: "component.form.upload.error.unknown",
  unsupported_upload_type: "component.form.upload.error.unsupportedType",
  upload_too_large: "component.form.upload.error.tooLarge",
};

/** Props for the control behind a metadata-declared file configuration field. */
export interface ComponentSourceFileFieldProps {
  /** Client used to stage a file, overridable so the control can be exercised without a server. */
  readonly client?: SourceUploadApiClient;
  /** Accessible description wiring supplied by the surrounding field. */
  readonly describedBy: string | undefined;
  /** Prevents both editing and uploading while a pipeline is locked. */
  readonly disabled: boolean;
  /** Identifier of the visible path control. */
  readonly id: string;
  /** Whether the surrounding field is reporting a validation failure. */
  readonly invalid: boolean;
  /** Receives the stored location, or undefined when the path is cleared. */
  readonly onChange: (value: string | undefined) => void;
  /** Placeholder shown while no path is set. */
  readonly placeholder: string | undefined;
  /** Whether a pipeline cannot execute without this path. */
  readonly required: boolean;
  /** The current stored location, relative to the import directory. */
  readonly value: string;
}

/**
 * Edits a storage location, and offers to supply the file that location names.
 *
 * The path stays directly editable because a deployment may already hold files
 * placed into internal storage by other means; uploading is a way to fill the
 * path in, not the only way to set it. A failed upload leaves any existing path
 * untouched, so a rejected file cannot quietly break a configured pipeline.
 */
export function ComponentSourceFileField({
  client = sourceUploadApiClient,
  describedBy,
  disabled,
  id,
  invalid,
  onChange,
  placeholder,
  required,
  value,
}: ComponentSourceFileFieldProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusId = useId();
  const [uploading, setUploading] = useState(false);
  const [statusKey, setStatusKey] = useState<TranslationKey | undefined>();
  const [failed, setFailed] = useState(false);

  async function upload(file: File): Promise<void> {
    setUploading(true);
    setStatusKey(undefined);
    setFailed(false);

    try {
      const staged = await client.upload(file);
      onChange(staged.sourcePath);
      setStatusKey("component.form.upload.succeeded");
    } catch (error) {
      setFailed(true);
      setStatusKey(isSourceUploadApiError(error)
        ? UPLOAD_ERROR_KEYS[error.code]
        : "component.form.upload.error.unknown");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="component-source-file-field">
      <div className="component-source-file-field__controls">
        <Input
          aria-describedby={[describedBy, statusKey === undefined ? undefined : statusId].filter(Boolean).join(" ") || undefined}
          aria-invalid={invalid}
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.value.length === 0 ? undefined : event.target.value)}
          placeholder={placeholder}
          required={required}
          value={value}
        />
        <Button
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
          type="button"
          variant="secondary"
        >
          {uploading ? t("component.form.upload.uploading") : t("component.form.upload.action")}
        </Button>
      </div>
      <input
        className="component-source-file-field__input"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) void upload(file);
        }}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      {statusKey === undefined ? null : (
        <p
          className={failed ? "ui-field__error" : "ui-field__description"}
          id={statusId}
          role={failed ? "alert" : "status"}
        >
          {t(statusKey)}
        </p>
      )}
    </div>
  );
}
