import { useI18n } from "../../locale-provider.js";

/** Presents the selected pipeline's edit-lock-derived history placeholder. */
export function PipelineHistoryPanel({ editable }: { readonly editable: boolean }) {
  const { t } = useI18n();

  return (
    <div className="pipeline-tab-panel">
      <p>{t("pipeline.history.description")}</p>
      <p>
        <strong>{t("pipeline.history.active")}:</strong>{" "}
        {editable ? t("pipeline.history.none") : t("pipeline.locked.title")}
      </p>
    </div>
  );
}
