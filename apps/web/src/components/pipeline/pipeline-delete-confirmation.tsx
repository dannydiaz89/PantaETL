import { useEffect, useRef, useState } from "react";

import { Button } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";

/** Requires a focused, explicit confirmation before deleting an idle pipeline. */
export function PipelineDeleteConfirmation({
  disabled,
  errorMessage,
  isDeleting,
  onDelete,
}: {
  readonly disabled: boolean;
  readonly errorMessage: string | undefined;
  readonly isDeleting: boolean;
  readonly onDelete: () => void;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const confirmation = useRef<HTMLElement>(null);

  useEffect(() => {
    if (confirming) confirmation.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return <Button disabled={disabled} onClick={() => setConfirming(true)} variant="danger">{t("pipeline.delete.open")}</Button>;
  }

  return (
    <section aria-describedby="pipeline-delete-description" aria-labelledby="pipeline-delete-title" className="pipeline-delete-confirmation" ref={confirmation} role="alertdialog" tabIndex={-1}>
      <div>
        <strong id="pipeline-delete-title">{t("pipeline.delete.title")}</strong>
        <p id="pipeline-delete-description">{t("pipeline.delete.description")}</p>
      </div>
      {errorMessage === undefined ? null : <p className="pipeline-mutation-error" role="alert">{errorMessage}</p>}
      <div className="pipeline-delete-confirmation__actions">
        <Button disabled={isDeleting} onClick={() => setConfirming(false)} variant="secondary">
          {t("pipeline.delete.cancel")}
        </Button>
        <Button disabled={isDeleting} onClick={onDelete} variant="danger">
          {isDeleting ? t("pipeline.delete.deleting") : t("pipeline.delete.confirm")}
        </Button>
      </div>
    </section>
  );
}
