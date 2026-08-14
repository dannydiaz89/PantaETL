"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { ComponentKind, ComponentMetadata, Pipeline } from "@pantaetl/contracts";

import { componentCapabilityListQueryOptions } from "../data/components/index.js";
import {
  pipelineDetailQueryOptions,
  useCreatePipelineMutation,
  useUpdatePipelineMutation,
} from "../data/pipelines/index.js";
import { useI18n } from "../locale-provider.js";
import { createPipelineBuilderDraftFromPipeline, createPipelineBuilderMetadataResolver } from "./pipeline/pipeline-builder-persistence.js";
import { getPipelineMutationErrorMessage } from "./pipeline/pipeline-mutation-feedback.js";
import { PipelineBuilderWizard } from "./pipeline/pipeline-builder-wizard.js";

/** Browser storage key remembering the pipeline this browser's wizard most recently saved, for resuming after a reload. */
const DRAFT_PIPELINE_ID_STORAGE_KEY = "pantaetl.pipeline-builder.draft-id";

/**
 * Owns the pipeline creation wizard's persistence: saving a draft through the real
 * create/update API, and resuming an in-progress draft after a page reload by
 * reconstructing wizard state from the pipeline this browser last saved.
 */
export function PipelineBuilderPage() {
  const { t } = useI18n();
  const [hydrated, setHydrated] = useState(false);
  const [resumeId, setResumeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setResumeId(window.localStorage.getItem(DRAFT_PIPELINE_ID_STORAGE_KEY) ?? undefined);
    setHydrated(true);
  }, []);

  const resuming = resumeId !== undefined;
  const detailQuery = useQuery({ ...pipelineDetailQueryOptions({ pipelineId: resumeId ?? "" }), enabled: resuming });
  const sourceQuery = useQuery({ ...componentCapabilityListQueryOptions({ kind: "source" }), enabled: resuming });
  const transformQuery = useQuery({ ...componentCapabilityListQueryOptions({ kind: "transform" }), enabled: resuming });
  const exportQuery = useQuery({ ...componentCapabilityListQueryOptions({ kind: "export" }), enabled: resuming });
  const capabilitiesByKind: Partial<Record<ComponentKind, readonly ComponentMetadata[]>> = {
    export: exportQuery.data?.components,
    source: sourceQuery.data?.components,
    transform: transformQuery.data?.components,
  };

  const createMutation = useCreatePipelineMutation();
  const updateMutation = useUpdatePipelineMutation();

  async function createPipeline(request: Parameters<typeof createMutation.mutateAsync>[0]): Promise<Pipeline> {
    const pipeline = await createMutation.mutateAsync(request);
    window.localStorage.setItem(DRAFT_PIPELINE_ID_STORAGE_KEY, pipeline.id);
    return pipeline;
  }

  async function updatePipeline(pipelineId: string, update: Parameters<typeof updateMutation.mutateAsync>[0]["update"]): Promise<Pipeline> {
    return updateMutation.mutateAsync({ pipelineId, update });
  }

  const resumeQueriesPending = resuming && (detailQuery.isPending || sourceQuery.isPending || transformQuery.isPending || exportQuery.isPending);
  if (!hydrated || resumeQueriesPending) {
    return (
      <div aria-live="polite" className="pipeline-query-state" role="status">
        <p>{t("pipeline.builder.resume.loading")}</p>
      </div>
    );
  }

  const resumeFailed = sourceQuery.isError || transformQuery.isError || exportQuery.isError;
  const resumedDraft = !resuming || detailQuery.data === undefined || resumeFailed
    ? undefined
    : createPipelineBuilderDraftFromPipeline(detailQuery.data, createPipelineBuilderMetadataResolver(capabilitiesByKind));

  if (resuming && resumedDraft === undefined) {
    window.localStorage.removeItem(DRAFT_PIPELINE_ID_STORAGE_KEY);
  }

  return (
    <PipelineBuilderWizard
      initialDraft={resumedDraft}
      initialPipelineId={resumedDraft === undefined ? undefined : resumeId}
      isSaving={createMutation.isPending || updateMutation.isPending}
      onCreate={createPipeline}
      onUpdate={updatePipeline}
      saveErrorMessage={getPipelineMutationErrorMessage(createMutation.error, t) ?? getPipelineMutationErrorMessage(updateMutation.error, t)}
    />
  );
}
