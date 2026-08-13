import { useEffect, useState } from "react";

import type { Pipeline, PipelineUpdateRequest } from "@pantaetl/contracts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import { PipelineDeleteConfirmation } from "./pipeline-delete-confirmation.js";
import { PipelineHistoryPanel } from "./pipeline-history-panel.js";
import { PipelineOverviewPanel } from "./pipeline-overview-panel.js";
import { PipelineSettingsPanel } from "./pipeline-settings-panel.js";
import { PipelineStateBadge } from "./pipeline-state-badge.js";
import { PipelineStepPanel } from "./pipeline-step-panel.js";
import { PipelineTriggerPanel } from "./pipeline-trigger-panel.js";

/** Coordinates the selected pipeline's form and its configuration panels. */
export function PipelineEditor({
  deleteErrorMessage,
  editable,
  isDeleting,
  isSaving,
  onDelete,
  onSave,
  pipeline,
  saveErrorMessage,
  saveSucceeded,
}: {
  readonly deleteErrorMessage: string | undefined;
  readonly editable: boolean;
  readonly isDeleting: boolean;
  readonly isSaving: boolean;
  readonly onDelete: () => void;
  readonly onSave: (update: PipelineUpdateRequest) => void;
  readonly pipeline: Pipeline;
  readonly saveErrorMessage: string | undefined;
  readonly saveSucceeded: boolean;
}) {
  const { t } = useI18n();
  const [draftName, setDraftName] = useState(pipeline.name);
  const [submitted, setSubmitted] = useState(false);
  const nameError = submitted && draftName.trim().length === 0 ? t("pipeline.nameRequired") : undefined;

  useEffect(() => {
    setDraftName(pipeline.name);
    setSubmitted(false);
  }, [pipeline.id, pipeline.name]);

  function saveDraft(): void {
    setSubmitted(true);
    if (!editable || draftName.trim().length === 0) return;

    onSave({ name: draftName.trim() });
  }

  return (
    <form className="pipeline-editor" onSubmit={(event) => { event.preventDefault(); saveDraft(); }}>
      <div className="pipeline-section-heading">
        <div>
          <h2>{t("pipeline.editor.title")}</h2>
          <p>{t("pipeline.editor.description")}</p>
        </div>
        <div className="pipeline-editor__actions">
          <PipelineStateBadge state={pipeline.state} />
          <PipelineDeleteConfirmation
            disabled={!editable}
            errorMessage={deleteErrorMessage}
            isDeleting={isDeleting}
            onDelete={onDelete}
          />
        </div>
      </div>
      {!editable ? (
        <div className="pipeline-lock-notice" role="status">
          <strong>{t("pipeline.locked.title")}</strong>
          <p>{t("pipeline.locked.description")}</p>
        </div>
      ) : null}
      {saveErrorMessage === undefined ? null : <p className="pipeline-mutation-error" role="alert">{saveErrorMessage}</p>}
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
            isSaving={isSaving}
            nameError={nameError}
            onDraftNameChange={setDraftName}
            saved={saveSucceeded}
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
