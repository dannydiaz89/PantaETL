"use client";

import { useCallback, useState, type ReactNode } from "react";

import type { Pipeline } from "@pantaetl/contracts";
import { Button } from "@pantaetl/ui";
import { isPipelineEditable } from "@pantaetl/pipeline";

import { PipelineEditor } from "./pipeline/pipeline-editor.js";
import { PipelineList } from "./pipeline/pipeline-list.js";
import { usePipelineDetailQuery, usePipelineListQuery } from "../data/pipelines/index.js";
import { getPipelineExecutionState } from "../lib/pipeline-boundary.js";
import { useI18n } from "../locale-provider.js";

/** Coordinates API-backed pipeline selection with the read-only editor workspace. */
export function PipelineWorkspace() {
  const listQuery = usePipelineListQuery();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const pipelines = listQuery.data?.pipelines ?? [];
  const selectedPipelineId = selectedId ?? pipelines[0]?.id;

  const selectPipeline = useCallback((pipeline: Pipeline) => {
    setSelectedId(pipeline.id);
  }, []);

  return (
    <section className="pipeline-workspace" data-hydrated={listQuery.isSuccess ? "true" : "false"}>
      <PipelineList
        isError={listQuery.isError}
        isLoading={listQuery.isPending}
        onRetry={() => void listQuery.refetch()}
        onSelect={selectPipeline}
        pipelines={pipelines}
      />
      {selectedPipelineId === undefined ? null : <SelectedPipeline pipelineId={selectedPipelineId} />}
    </section>
  );
}

/** Loads the selected pipeline graph through the shared detail query and its cache. */
function SelectedPipeline({ pipelineId }: { readonly pipelineId: string }) {
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

  return <PipelineEditor editable={isPipelineEditable(getPipelineExecutionState(detailQuery.data))} pipeline={detailQuery.data} />;
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
