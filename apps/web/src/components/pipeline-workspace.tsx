"use client";

import { useCallback, useState, type ReactNode } from "react";

import type { Pipeline, PipelineUpdateRequest } from "@pantaetl/contracts";
import { Button } from "@pantaetl/ui";
import { isPipelineEditable } from "@pantaetl/pipeline";

import { PipelineEditor } from "./pipeline/pipeline-editor.js";
import { PipelineList } from "./pipeline/pipeline-list.js";
import { getPipelineMutationErrorMessage } from "./pipeline/pipeline-mutation-feedback.js";
import {
  useCreatePipelineMutation,
  useDeletePipelineMutation,
  usePipelineDetailQuery,
  usePipelineListQuery,
  useUpdatePipelineMutation,
} from "../data/pipelines/index.js";
import { getPipelineExecutionState } from "../lib/pipeline-boundary.js";
import { useI18n } from "../locale-provider.js";

/** Coordinates API-backed pipeline selection with the read-only editor workspace. */
export function PipelineWorkspace() {
  const { t } = useI18n();
  const listQuery = usePipelineListQuery();
  const createMutation = useCreatePipelineMutation();
  const updateMutation = useUpdatePipelineMutation();
  const deleteMutation = useDeletePipelineMutation();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [lastSavedPipelineId, setLastSavedPipelineId] = useState<string | undefined>();
  const pipelines = listQuery.data?.pipelines ?? [];
  const selectedPipelineId = selectedId ?? pipelines[0]?.id;

  const selectPipeline = useCallback((pipeline: Pipeline) => {
    setSelectedId(pipeline.id);
  }, []);

  const createPipeline = useCallback((
    request: Parameters<typeof createMutation.mutate>[0],
    onSuccess: () => void,
  ) => {
    createMutation.mutate(request, {
      onSuccess: (pipeline) => {
        setSelectedId(pipeline.id);
        onSuccess();
      },
    });
  }, [createMutation]);

  return (
    <section className="pipeline-workspace" data-hydrated={listQuery.isSuccess ? "true" : "false"}>
      <PipelineList
        createErrorMessage={getPipelineMutationErrorMessage(createMutation.error, t)}
        isCreating={createMutation.isPending}
        isError={listQuery.isError}
        isLoading={listQuery.isPending}
        onCreate={createPipeline}
        onRetry={() => void listQuery.refetch()}
        onSelect={selectPipeline}
        pipelines={pipelines}
      />
      {selectedPipelineId === undefined ? null : (
        <SelectedPipeline
          deleteErrorMessage={getPipelineMutationErrorMessage(deleteMutation.error, t)}
          isDeleting={deleteMutation.isPending}
          isSaving={updateMutation.isPending}
          onDelete={(pipelineId) => deleteMutation.mutate({ pipelineId }, { onSuccess: () => setSelectedId(undefined) })}
          onSave={(pipelineId, update) => updateMutation.mutate(
            { pipelineId, update },
            { onSuccess: () => setLastSavedPipelineId(pipelineId) },
          )}
          pipelineId={selectedPipelineId}
          saveErrorMessage={getPipelineMutationErrorMessage(updateMutation.error, t)}
          saveSucceeded={lastSavedPipelineId === selectedPipelineId && updateMutation.isSuccess}
        />
      )}
    </section>
  );
}

/** Loads the selected pipeline graph through the shared detail query and its cache. */
function SelectedPipeline({
  deleteErrorMessage,
  isDeleting,
  isSaving,
  onDelete,
  onSave,
  pipelineId,
  saveErrorMessage,
  saveSucceeded,
}: {
  readonly deleteErrorMessage: string | undefined;
  readonly isDeleting: boolean;
  readonly isSaving: boolean;
  readonly onDelete: (pipelineId: string) => void;
  readonly onSave: (pipelineId: string, update: PipelineUpdateRequest) => void;
  readonly pipelineId: string;
  readonly saveErrorMessage: string | undefined;
  readonly saveSucceeded: boolean;
}) {
  const { t } = useI18n();
  const detailQuery = usePipelineDetailQuery({ pipelineId });

  if (detailQuery.isPending) {
    return <PipelineQueryState message={t("pipeline.editor.loading")} />;
  }

  if (detailQuery.isError || detailQuery.data === undefined) {
    return (
      <PipelineQueryState message={t("pipeline.editor.error")} role="alert">
        <Button onClick={() => void detailQuery.refetch()} variant="secondary">
          {t("pipeline.retry")}
        </Button>
      </PipelineQueryState>
    );
  }

  return (
    <PipelineEditor
      deleteErrorMessage={deleteErrorMessage}
      editable={isPipelineEditable(getPipelineExecutionState(detailQuery.data))}
      isDeleting={isDeleting}
      isSaving={isSaving}
      onDelete={() => onDelete(detailQuery.data.id)}
      onSave={(update) => onSave(detailQuery.data.id, update)}
      pipeline={detailQuery.data}
      saveErrorMessage={saveErrorMessage}
      saveSucceeded={saveSucceeded}
    />
  );
}

/** Renders a localized, safe query status without exposing transport diagnostics. */
function PipelineQueryState({
  children,
  message,
  role = "status",
}: {
  readonly children?: ReactNode;
  readonly message: string;
  readonly role?: "alert" | "status";
}) {
  return (
    <div aria-live={role === "alert" ? "assertive" : "polite"} className="pipeline-query-state" role={role}>
      <p>{message}</p>
      {children}
    </div>
  );
}
