import type { Trigger } from "@pantaetl/contracts";

import { useI18n } from "../../locale-provider.js";

/** Displays pipeline-owned manual and scheduled trigger configuration. */
export function PipelineTriggerPanel({ triggers }: { readonly triggers: readonly Trigger[] }) {
  const { t } = useI18n();

  return (
    <div className="pipeline-tab-panel">
      <p>{t("pipeline.trigger.description")}</p>
      {triggers.length === 0 ? <p>{t("pipeline.trigger.none")}</p> : triggers.map((trigger) => (
        <dl className="pipeline-trigger" key={trigger.id}>
          <dt>{trigger.type === "manual" ? t("pipeline.trigger.manual") : t("pipeline.trigger.schedule")}</dt>
          <dd>{trigger.enabled ? t("pipeline.state.enabled") : t("pipeline.state.disabled")}</dd>
          {trigger.type === "schedule" ? <>
            <dt>{t("pipeline.trigger.cron")}</dt>
            <dd>{trigger.cron}</dd>
            <dt>{t("pipeline.trigger.timezone")}</dt>
            <dd>{trigger.timezone}</dd>
          </> : null}
        </dl>
      ))}
    </div>
  );
}
