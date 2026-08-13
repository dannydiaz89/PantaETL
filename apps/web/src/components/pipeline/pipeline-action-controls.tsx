import { useState } from "react";

import type { PipelineDetailRequest, PipelineState } from "@pantaetl/contracts";
import { Button } from "@pantaetl/ui";

import {
  isPipelineApiError,
  useDisablePipelineMutation,
  useDuplicatePipelineMutation,
  useEnablePipelineMutation,
  useRunPipelineMutation,
} from "../../data/pipelines/index.js";
import { useI18n } from "../../locale-provider.js";

/** Renders safe pipeline lifecycle actions without owning any editor draft fields. */
export function PipelineActionControls({
  editable,
  pipelineId,
  state,
}: {
  readonly editable: boolean;
  readonly pipelineId: PipelineDetailRequest["pipelineId"];
  readonly state: PipelineState;
}) {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState<{ readonly kind: "error" | "success"; readonly message: string } | undefined>();
  const duplicate = useDuplicatePipelineMutation();
  const run = useRunPipelineMutation();
  const enable = useEnablePipelineMutation();
  const disable = useDisablePipelineMutation();
  const isBusy = duplicate.isPending || run.isPending || enable.isPending || disable.isPending;

  function handleDuplicate(): void {
    setFeedback(undefined);
    duplicate.mutate({ pipelineId }, { onError: showError, onSuccess: () => showSuccess("pipeline.actions.duplicateSuccess") });
  }

  function handleRun(): void {
    setFeedback(undefined);
    run.mutate({ pipelineId }, { onError: showError, onSuccess: () => showSuccess("pipeline.actions.runSuccess") });
  }

  function handleStateChange(action: "disable" | "enable"): void {
    setFeedback(undefined);
    const mutation = action === "enable" ? enable : disable;
    mutation.mutate(
      { pipelineId },
      { onError: showError, onSuccess: () => showSuccess(action === "enable" ? "pipeline.actions.enableSuccess" : "pipeline.actions.disableSuccess") },
    );
  }

  function showError(error: Error): void {
    setFeedback({ kind: "error", message: getActionErrorMessage(error, t) });
  }

  function showSuccess(key: Parameters<typeof t>[0]): void {
    setFeedback({ kind: "success", message: t(key) });
  }

  return (
    <section aria-labelledby="pipeline-actions-title" className="pipeline-action-controls">
      <div>
        <h3 id="pipeline-actions-title">{t("pipeline.actions.title")}</h3>
        <p>{t("pipeline.actions.description")}</p>
      </div>
      <div className="pipeline-action-controls__buttons">
        <Button disabled={isBusy} onClick={handleDuplicate} variant="secondary">
          {duplicate.isPending ? t("pipeline.actions.duplicating") : t("pipeline.actions.duplicate")}
        </Button>
        <Button disabled={isBusy || !editable || state !== "enabled"} onClick={handleRun}>
          {run.isPending ? t("pipeline.actions.running") : t("pipeline.actions.run")}
        </Button>
        {state === "enabled" ? (
          <Button disabled={isBusy || !editable} onClick={() => handleStateChange("disable")} variant="secondary">
            {disable.isPending ? t("pipeline.actions.disabling") : t("pipeline.actions.disable")}
          </Button>
        ) : (
          <Button disabled={isBusy || !editable} onClick={() => handleStateChange("enable")} variant="secondary">
            {enable.isPending ? t("pipeline.actions.enabling") : t("pipeline.actions.enable")}
          </Button>
        )}
      </div>
      {feedback === undefined ? null : (
        <p className={`pipeline-action-controls__status pipeline-action-controls__status--${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>
          {feedback.message}
        </p>
      )}
    </section>
  );
}

/** Selects localized safe action feedback without exposing API or scheduler diagnostics. */
function getActionErrorMessage(error: Error, t: ReturnType<typeof useI18n>["t"]): string {
  if (!isPipelineApiError(error)) return t("pipeline.actions.error.unavailable");

  switch (error.code) {
    case "pipeline_locked": return t("pipeline.actions.error.locked");
    case "pipeline_not_enabled": return t("pipeline.actions.error.notEnabled");
    case "pipeline_not_found": return t("pipeline.actions.error.notFound");
    default: return t("pipeline.actions.error.unavailable");
  }
}
