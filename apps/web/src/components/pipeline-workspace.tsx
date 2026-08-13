"use client";

import { useCallback, useEffect, useState } from "react";

import type { Pipeline } from "@pantaetl/contracts";
import { enqueuePipelineRun, isPipelineEditable } from "@pantaetl/pipeline";

import { PipelineEditor } from "./pipeline/pipeline-editor.js";
import { createPipelineFixtures, lockedPipelineId } from "./pipeline/pipeline-fixtures.js";
import { PipelineList } from "./pipeline/pipeline-list.js";
import { getPipelineExecutionState } from "../lib/pipeline-boundary.js";
import { useI18n } from "../locale-provider.js";

/** Coordinates fixture selection and local draft state until API-backed pipeline data is available. */
export function PipelineWorkspace() {
  const { t } = useI18n();
  const [pipelines, setPipelines] = useState(() => createPipelineFixtures(t));
  const [selectedId, setSelectedId] = useState(lockedPipelineId);
  const [hydrated, setHydrated] = useState(false);
  const selectedPipeline = pipelines.find((pipeline) => pipeline.id === selectedId) ?? pipelines[0];
  const editable = isPipelineEditable(getFixtureExecutionState(selectedPipeline));
  const [draftName, setDraftName] = useState(selectedPipeline.name);
  const [saved, setSaved] = useState(false);

  useEffect(() => setHydrated(true), []);

  const selectPipeline = useCallback((pipeline: Pipeline) => {
    setSelectedId(pipeline.id);
    setDraftName(pipeline.name);
    setSaved(false);
  }, []);
  const savePipeline = useCallback(() => {
    if (!editable) {
      return;
    }

    setPipelines((current) => current.map((pipeline) => (
      pipeline.id === selectedPipeline.id ? { ...pipeline, name: draftName, updatedAt: new Date().toISOString() } : pipeline
    )));
    setSaved(true);
  }, [draftName, editable, selectedPipeline.id]);

  return (
    <section className="pipeline-workspace" data-hydrated={hydrated ? "true" : "false"}>
      <PipelineList onSelect={selectPipeline} pipelines={pipelines} />
      <PipelineEditor
        draftName={draftName}
        editable={editable}
        onDraftNameChange={setDraftName}
        onSave={savePipeline}
        pipeline={selectedPipeline}
        saved={saved}
      />
    </section>
  );
}

/** Adds the fixture's representative queued run to the shared execution-state calculation. */
function getFixtureExecutionState(pipeline: Pipeline) {
  const state = getPipelineExecutionState(pipeline);

  return pipeline.id === lockedPipelineId ? enqueuePipelineRun(state, "123e4567-e89b-12d3-a456-426614174106") : state;
}
