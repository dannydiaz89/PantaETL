import { useMemo } from "react";

import type { PipelineDetailRequest, PipelineState } from "@pantaetl/contracts";
import { Field, Select } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import { PipelineActionControls } from "./pipeline-action-controls.js";

/** Displays state controls, respecting the shared pipeline execution lock. */
export function PipelineSettingsPanel({
  editable,
  pipelineId,
  state,
}: {
  readonly editable: boolean;
  readonly pipelineId: PipelineDetailRequest["pipelineId"];
  readonly state: PipelineState;
}) {
  const { t } = useI18n();
  const stateOptions = useMemo(() => [
    { label: t("pipeline.state.draft"), value: "draft" },
    { label: t("pipeline.state.enabled"), value: "enabled" },
    { label: t("pipeline.state.disabled"), value: "disabled" },
  ] as const, [t]);

  return (
    <div className="pipeline-tab-panel">
      <p>{t("pipeline.settings.description")}</p>
      <Field label={t("pipeline.state")}>
        {({ describedBy, id, invalid }) => (
          <Select
            aria-describedby={describedBy}
            aria-invalid={invalid}
            disabled={!editable}
            id={id}
            options={stateOptions}
            placeholder={t("pipeline.statePlaceholder")}
            value={state}
          />
        )}
      </Field>
      <PipelineActionControls editable={editable} pipelineId={pipelineId} state={state} />
    </div>
  );
}
