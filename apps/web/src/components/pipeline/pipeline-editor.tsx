import type { Pipeline } from "@pantaetl/contracts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import { PipelineHistoryPanel } from "./pipeline-history-panel.js";
import { PipelineOverviewPanel } from "./pipeline-overview-panel.js";
import { PipelineSettingsPanel } from "./pipeline-settings-panel.js";
import { PipelineStateBadge } from "./pipeline-state-badge.js";
import { PipelineStepPanel } from "./pipeline-step-panel.js";
import { PipelineTriggerPanel } from "./pipeline-trigger-panel.js";

/** Coordinates the selected pipeline's form and its configuration panels. */
export function PipelineEditor({
  draftName,
  editable,
  onDraftNameChange,
  onSave,
  pipeline,
  saved,
}: {
  readonly draftName: string;
  readonly editable: boolean;
  readonly onDraftNameChange: (value: string) => void;
  readonly onSave: () => void;
  readonly pipeline: Pipeline;
  readonly saved: boolean;
}) {
  const { t } = useI18n();

  return (
    <form className="pipeline-editor" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <div className="pipeline-section-heading">
        <div>
          <h2>{t("pipeline.editor.title")}</h2>
          <p>{t("pipeline.editor.description")}</p>
        </div>
        <PipelineStateBadge state={pipeline.state} />
      </div>
      {!editable ? (
        <div className="pipeline-lock-notice" role="status">
          <strong>{t("pipeline.locked.title")}</strong>
          <p>{t("pipeline.locked.description")}</p>
        </div>
      ) : null}
      <Tabs defaultValue="overview">
        <TabsList aria-label={t("pipeline.editor.title")}>
          <TabsTrigger value="overview">{t("pipeline.tab.overview")}</TabsTrigger>
          <TabsTrigger value="source">{t("pipeline.tab.source")}</TabsTrigger>
          <TabsTrigger value="transforms">{t("pipeline.tab.transforms")}</TabsTrigger>
          <TabsTrigger value="export">{t("pipeline.tab.export")}</TabsTrigger>
          <TabsTrigger value="trigger">{t("pipeline.tab.trigger")}</TabsTrigger>
          <TabsTrigger value="history">{t("pipeline.tab.history")}</TabsTrigger>
          <TabsTrigger value="settings">{t("pipeline.tab.settings")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <PipelineOverviewPanel
            draftName={draftName}
            editable={editable}
            onDraftNameChange={onDraftNameChange}
            saved={saved}
          />
        </TabsContent>
        <TabsContent value="source">
          <PipelineStepPanel description={t("pipeline.source.description")} kind="source" pipeline={pipeline} />
        </TabsContent>
        <TabsContent value="transforms">
          <PipelineStepPanel description={t("pipeline.transforms.description")} kind="transform" pipeline={pipeline} />
        </TabsContent>
        <TabsContent value="export">
          <PipelineStepPanel description={t("pipeline.export.description")} kind="export" pipeline={pipeline} />
        </TabsContent>
        <TabsContent value="trigger"><PipelineTriggerPanel triggers={pipeline.triggers} /></TabsContent>
        <TabsContent value="history"><PipelineHistoryPanel editable={editable} /></TabsContent>
        <TabsContent value="settings"><PipelineSettingsPanel editable={editable} state={pipeline.state} /></TabsContent>
      </Tabs>
    </form>
  );
}
