import { useEffect, useState } from "react";

import type { Pipeline, PipelineUpdateRequest } from "@pantaetl/contracts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pantaetl/ui";

import { useComponentCapabilityListQuery } from "../../data/components/index.js";
import { useI18n } from "../../locale-provider.js";
import { ComponentPickerConfiguration } from "./component-picker.js";
import { createPipelineBuilderCompatibilityResolver } from "./pipeline-builder-compatibility.js";
import { PipelineDeleteConfirmation } from "./pipeline-delete-confirmation.js";
import { PipelineHistoryPanel } from "./pipeline-history-panel.js";
import { PipelineOverviewPanel } from "./pipeline-overview-panel.js";
import {
  addPipelineBuilderTransform,
  movePipelineBuilderTransform,
  pipelineBuilderChainTail,
  removePipelineBuilderTransform,
  setPipelineBuilderExport,
  setPipelineBuilderExportValues,
  setPipelineBuilderSource,
  setPipelineBuilderSourceValues,
  setPipelineBuilderTransformValues,
  type PipelineBuilderDraft,
} from "./pipeline-builder-draft.js";
import { createPipelineBuilderDraftFromPipeline, createPipelineBuilderMetadataResolver, createPipelineUpdateRequestFromDraft } from "./pipeline-builder-persistence.js";
import { PipelineBuilderTransformsStep } from "./pipeline-builder-transforms-step.js";
import { PipelineSettingsPanel } from "./pipeline-settings-panel.js";
import { PipelineStateBadge } from "./pipeline-state-badge.js";
import { PipelineStepPanel } from "./pipeline-step-panel.js";
import {
  addPipelineScheduleTrigger,
  createPipelineTriggerDraft,
  removePipelineScheduleTrigger,
  setPipelineManualTriggerEnabled,
  updatePipelineScheduleTrigger,
  writablePipelineTriggersFromDraft,
  type PipelineTriggerDraft,
} from "./pipeline-trigger-draft.js";
import { PipelineTriggerEditor } from "./pipeline-trigger-editor.js";
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

  const sourceCapabilities = useComponentCapabilityListQuery({ kind: "source" });
  const transformCapabilities = useComponentCapabilityListQuery({ kind: "transform" });
  const exportCapabilities = useComponentCapabilityListQuery({ kind: "export" });
  const capabilitiesReady = sourceCapabilities.isSuccess && transformCapabilities.isSuccess && exportCapabilities.isSuccess;
  const [graphDraft, setGraphDraft] = useState<PipelineBuilderDraft | undefined>(undefined);
  const [triggerDraft, setTriggerDraft] = useState<PipelineTriggerDraft>(() => createPipelineTriggerDraft(pipeline.triggers));

  useEffect(() => {
    setDraftName(pipeline.name);
    setSubmitted(false);
    setTriggerDraft(createPipelineTriggerDraft(pipeline.triggers));
  }, [pipeline.id, pipeline.name, pipeline.triggers]);

  useEffect(() => {
    if (!capabilitiesReady) return;

    const resolveMetadata = createPipelineBuilderMetadataResolver({
      export: exportCapabilities.data?.components,
      source: sourceCapabilities.data?.components,
      transform: transformCapabilities.data?.components,
    });
    setGraphDraft(createPipelineBuilderDraftFromPipeline(pipeline, resolveMetadata));
    // Capability lists are stable once loaded; only a change of pipeline identity should re-seed local edits.
  }, [pipeline.id, capabilitiesReady]);

  function updateGraphDraft(updater: (draft: PipelineBuilderDraft) => PipelineBuilderDraft): void {
    setGraphDraft((current) => (current === undefined ? current : updater(current)));
  }

  function updateTriggerDraft(updater: (draft: PipelineTriggerDraft) => PipelineTriggerDraft): void {
    setTriggerDraft(updater);
  }

  const compatibilityOptionState = createPipelineBuilderCompatibilityResolver(
    graphDraft === undefined ? undefined : pipelineBuilderChainTail(graphDraft),
    t("pipeline.builder.compatibility.incompatible"),
  );

  function saveDraft(): void {
    setSubmitted(true);
    if (!editable || draftName.trim().length === 0) return;

    const graphUpdate = editable && graphDraft !== undefined ? createPipelineUpdateRequestFromDraft(graphDraft) : {};
    onSave({ ...graphUpdate, name: draftName.trim(), triggers: writablePipelineTriggersFromDraft(triggerDraft) });
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
          {editable && graphDraft !== undefined ? (
            <div className="pipeline-tab-panel">
              <p>{t("pipeline.source.description")}</p>
              <ComponentPickerConfiguration
                kind="source"
                onSelect={(metadata) => updateGraphDraft((draft) => setPipelineBuilderSource(draft, metadata))}
                onValuesChange={(values) => updateGraphDraft((draft) => setPipelineBuilderSourceValues(draft, values))}
                selected={graphDraft.source?.metadata}
                values={graphDraft.source?.values ?? {}}
              />
            </div>
          ) : (
            <PipelineStepPanel description={t("pipeline.source.description")} kind="source" pipeline={pipeline} />
          )}
        </TabsContent>
        <TabsContent value="transforms">
          {editable && graphDraft !== undefined ? (
            <div className="pipeline-tab-panel">
              <p>{t("pipeline.transforms.description")}</p>
              <PipelineBuilderTransformsStep
                getOptionState={compatibilityOptionState}
                onAdd={(metadata) => updateGraphDraft((draft) => addPipelineBuilderTransform(draft, metadata))}
                onMove={(id, direction) => updateGraphDraft((draft) => movePipelineBuilderTransform(draft, id, direction))}
                onRemove={(id) => updateGraphDraft((draft) => removePipelineBuilderTransform(draft, id))}
                onValuesChange={(id, values) => updateGraphDraft((draft) => setPipelineBuilderTransformValues(draft, id, values))}
                transforms={graphDraft.transforms}
              />
            </div>
          ) : (
            <PipelineStepPanel description={t("pipeline.transforms.description")} kind="transform" pipeline={pipeline} />
          )}
        </TabsContent>
        <TabsContent value="export">
          {editable && graphDraft !== undefined ? (
            <div className="pipeline-tab-panel">
              <p>{t("pipeline.export.description")}</p>
              <ComponentPickerConfiguration
                getOptionState={compatibilityOptionState}
                kind="export"
                onSelect={(metadata) => updateGraphDraft((draft) => setPipelineBuilderExport(draft, metadata))}
                onValuesChange={(values) => updateGraphDraft((draft) => setPipelineBuilderExportValues(draft, values))}
                selected={graphDraft.export?.metadata}
                values={graphDraft.export?.values ?? {}}
              />
            </div>
          ) : (
            <PipelineStepPanel description={t("pipeline.export.description")} kind="export" pipeline={pipeline} />
          )}
        </TabsContent>
        <TabsContent value="trigger">
          {editable ? (
            <div className="pipeline-tab-panel">
              <p>{t("pipeline.trigger.description")}</p>
              <PipelineTriggerEditor
                disabled={!editable}
                draft={triggerDraft}
                onAddSchedule={() => updateTriggerDraft(addPipelineScheduleTrigger)}
                onChangeManualEnabled={(enabled) => updateTriggerDraft((draft) => setPipelineManualTriggerEnabled(draft, enabled))}
                onChangeSchedule={(localId, changes) => updateTriggerDraft((draft) => updatePipelineScheduleTrigger(draft, localId, changes))}
                onRemoveSchedule={(localId) => updateTriggerDraft((draft) => removePipelineScheduleTrigger(draft, localId))}
              />
            </div>
          ) : (
            <PipelineTriggerPanel triggers={pipeline.triggers} />
          )}
        </TabsContent>
        <TabsContent value="history"><PipelineHistoryPanel editable={editable} /></TabsContent>
        <TabsContent value="settings"><PipelineSettingsPanel editable={editable} pipelineId={pipeline.id} state={pipeline.state} /></TabsContent>
      </Tabs>
    </form>
  );
}
