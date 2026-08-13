import type { Pipeline, PipelineStep } from "@pantaetl/contracts";

import { useI18n } from "../../locale-provider.js";

/** Shows the selected pipeline components of one processing role. */
export function PipelineStepPanel({
  description,
  kind,
  pipeline,
}: {
  readonly description: string;
  readonly kind: PipelineStep["kind"];
  readonly pipeline: Pipeline;
}) {
  const { t } = useI18n();
  const steps = pipeline.steps.filter((step) => step.kind === kind);

  return (
    <div className="pipeline-tab-panel">
      <p>{description}</p>
      {steps.length === 0 ? <p>{t("pipeline.components.empty")}</p> : (
        <ul className="pipeline-component-list">
          {steps.map((step) => (
            <li key={step.id}>
              <strong>{step.componentType}</strong>
              <span>{t("pipeline.components.version")}: {step.componentVersion}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
