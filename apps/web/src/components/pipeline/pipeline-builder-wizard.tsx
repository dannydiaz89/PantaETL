import { useState } from "react";

import type { ComponentConfiguration, ComponentMetadata, Pipeline, PipelineCreateRequest, PipelineUpdateRequest } from "@pantaetl/contracts";
import { Button, Check, Field, Icon, Input } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import type { TranslationKey } from "../../locales/en.js";
import { ComponentPickerConfiguration } from "./component-picker.js";
import {
  addPipelineBuilderTransform,
  createEmptyPipelineBuilderDraft,
  isPipelineBuilderDraftComplete,
  markPipelineBuilderDraftSaved,
  movePipelineBuilderTransform,
  nextPipelineBuilderStep,
  PIPELINE_BUILDER_STEPS,
  previousPipelineBuilderStep,
  removePipelineBuilderTransform,
  setPipelineBuilderExport,
  setPipelineBuilderExportValues,
  setPipelineBuilderSource,
  setPipelineBuilderSourceValues,
  setPipelineBuilderTransformValues,
  updatePipelineBuilderDraft,
  type PipelineBuilderDraft,
  type PipelineBuilderStep,
} from "./pipeline-builder-draft.js";
import {
  createPipelineCreateRequestFromDraft,
  createPipelineUpdateRequestFromDraft,
  isPipelineBuilderDraftPersistable,
} from "./pipeline-builder-persistence.js";
import { PipelineBuilderTransformsStep } from "./pipeline-builder-transforms-step.js";

type StepStatus = "completed" | "current" | "upcoming";

const STEP_LABEL_KEYS: Readonly<Record<PipelineBuilderStep, TranslationKey>> = {
  export: "pipeline.builder.step.export.label",
  source: "pipeline.builder.step.source.label",
  transforms: "pipeline.builder.step.transforms.label",
};

const STEP_POSITION_KEYS: Readonly<Record<PipelineBuilderStep, TranslationKey>> = {
  export: "pipeline.builder.step.export.position",
  source: "pipeline.builder.step.source.position",
  transforms: "pipeline.builder.step.transforms.position",
};

const STEP_DESCRIPTION_KEYS: Readonly<Record<PipelineBuilderStep, TranslationKey>> = {
  export: "pipeline.builder.step.export.description",
  source: "pipeline.builder.step.source.description",
  transforms: "pipeline.builder.step.transforms.description",
};

const STEP_STATUS_KEYS: Readonly<Record<StepStatus, TranslationKey>> = {
  completed: "pipeline.builder.status.completed",
  current: "pipeline.builder.status.current",
  upcoming: "pipeline.builder.status.upcoming",
};

/** Properties accepted by the pipeline creation wizard shell. */
export interface PipelineBuilderWizardProps {
  /** Seeds the wizard with an existing draft, for example when resuming a saved draft. */
  readonly initialDraft?: PipelineBuilderDraft;
  /** The id of a pipeline already saved from a previous session of this wizard, if any. */
  readonly initialPipelineId?: string;
  /** Seeds the wizard at a specific stage instead of the first stage. */
  readonly initialStep?: PipelineBuilderStep;
  /** True while a save requested through `onCreate`/`onUpdate` is in flight. */
  readonly isSaving?: boolean;
  /** Persists a draft that has never been saved before; resolves with the created pipeline. */
  readonly onCreate?: (request: PipelineCreateRequest) => Promise<Pipeline>;
  /** Notified whenever the local draft changes, for callers that persist or preview it. */
  readonly onDraftChange?: (draft: PipelineBuilderDraft) => void;
  /** Persists changes to a pipeline this wizard has already saved; resolves with the updated pipeline. */
  readonly onUpdate?: (pipelineId: string, request: PipelineUpdateRequest) => Promise<Pipeline>;
  /** Localized explanation shown when the most recent save attempt failed. */
  readonly saveErrorMessage?: string;
}

/**
 * Three-step Source/Transforms/Export pipeline creation shell.
 *
 * Owns the local in-progress draft and step navigation. Each stage selects
 * and configures components from the capability catalog; the final stage
 * replaces Next with a readiness status once there is no further step. A
 * draft can be saved as soon as the canonical contract can represent it
 * (a name and at least one component), even if it is not yet complete;
 * the first successful save creates the pipeline, and later saves update it.
 */
export function PipelineBuilderWizard({
  initialDraft,
  initialPipelineId,
  initialStep,
  isSaving = false,
  onCreate,
  onDraftChange,
  onUpdate,
  saveErrorMessage,
}: PipelineBuilderWizardProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<PipelineBuilderDraft>(() => initialDraft ?? createEmptyPipelineBuilderDraft());
  const [step, setStep] = useState<PipelineBuilderStep>(initialStep ?? PIPELINE_BUILDER_STEPS[0]);
  const [pipelineId, setPipelineId] = useState<string | undefined>(initialPipelineId);
  const currentIndex = PIPELINE_BUILDER_STEPS.indexOf(step);
  const nextStep = nextPipelineBuilderStep(step);
  const previousStep = previousPipelineBuilderStep(step);
  const canSave = isPipelineBuilderDraftPersistable(draft) && (pipelineId === undefined ? onCreate : onUpdate) !== undefined;

  async function save(): Promise<void> {
    if (!canSave || isSaving) return;

    try {
      const pipeline = pipelineId === undefined
        ? await onCreate?.(createPipelineCreateRequestFromDraft(draft))
        : await onUpdate?.(pipelineId, createPipelineUpdateRequestFromDraft(draft));
      if (pipeline === undefined) return;

      setPipelineId(pipeline.id);
      setDraft(markPipelineBuilderDraftSaved);
    } catch {
      // The caller surfaces the failure through `saveErrorMessage`; the draft is left untouched so no input is lost.
    }
  }

  function changeName(name: string): void {
    setDraft((current) => {
      const next = updatePipelineBuilderDraft(current, { name });
      onDraftChange?.(next);
      return next;
    });
  }

  function changeSource(metadata: ComponentMetadata): void {
    setDraft((current) => {
      const next = setPipelineBuilderSource(current, metadata);
      onDraftChange?.(next);
      return next;
    });
  }

  function changeSourceValues(values: ComponentConfiguration["values"]): void {
    setDraft((current) => {
      const next = setPipelineBuilderSourceValues(current, values);
      onDraftChange?.(next);
      return next;
    });
  }

  function addTransform(metadata: ComponentMetadata): void {
    setDraft((current) => {
      const next = addPipelineBuilderTransform(current, metadata);
      onDraftChange?.(next);
      return next;
    });
  }

  function changeTransformValues(id: string, values: ComponentConfiguration["values"]): void {
    setDraft((current) => {
      const next = setPipelineBuilderTransformValues(current, id, values);
      onDraftChange?.(next);
      return next;
    });
  }

  function removeTransform(id: string): void {
    setDraft((current) => {
      const next = removePipelineBuilderTransform(current, id);
      onDraftChange?.(next);
      return next;
    });
  }

  function moveTransform(id: string, direction: "up" | "down"): void {
    setDraft((current) => {
      const next = movePipelineBuilderTransform(current, id, direction);
      onDraftChange?.(next);
      return next;
    });
  }

  function changeExport(metadata: ComponentMetadata): void {
    setDraft((current) => {
      const next = setPipelineBuilderExport(current, metadata);
      onDraftChange?.(next);
      return next;
    });
  }

  function changeExportValues(values: ComponentConfiguration["values"]): void {
    setDraft((current) => {
      const next = setPipelineBuilderExportValues(current, values);
      onDraftChange?.(next);
      return next;
    });
  }

  return (
    <section className="pipeline-builder">
      <div className="pipeline-section-heading">
        <div>
          <h1>{t("pipeline.builder.title")}</h1>
          <p>{t("pipeline.builder.description")}</p>
        </div>
      </div>

      <Field label={t("pipeline.name")} description={t("pipeline.nameDescription")} required>
        {({ describedBy, id, invalid }) => (
          <Input
            aria-describedby={describedBy}
            aria-invalid={invalid}
            id={id}
            onChange={(event) => changeName(event.target.value)}
            required
            value={draft.name}
          />
        )}
      </Field>

      <ol aria-label={t("pipeline.builder.progressLabel")} className="pipeline-builder__steps">
        {PIPELINE_BUILDER_STEPS.map((candidate, index) => {
          const status: StepStatus = candidate === step ? "current" : index < currentIndex ? "completed" : "upcoming";

          return (
            <li
              aria-current={status === "current" ? "step" : undefined}
              className={`pipeline-builder__step pipeline-builder__step--${status}`}
              key={candidate}
            >
              <span aria-hidden="true" className="pipeline-builder__step-index">
                {status === "completed" ? <Icon icon={Check} /> : index + 1}
              </span>
              <span className="pipeline-builder__step-label">
                {t(STEP_LABEL_KEYS[candidate])}
                <small className="pipeline-builder__step-status">{t(STEP_STATUS_KEYS[status])}</small>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="pipeline-builder__content">
        <p className="pipeline-builder__step-position">{t(STEP_POSITION_KEYS[step])}</p>
        <p>{t(STEP_DESCRIPTION_KEYS[step])}</p>
        {step === "source" ? (
          <ComponentPickerConfiguration
            kind="source"
            onSelect={changeSource}
            onValuesChange={changeSourceValues}
            selected={draft.source?.metadata}
            values={draft.source?.values ?? {}}
          />
        ) : null}
        {step === "transforms" ? (
          <PipelineBuilderTransformsStep
            onAdd={addTransform}
            onMove={moveTransform}
            onRemove={removeTransform}
            onValuesChange={changeTransformValues}
            transforms={draft.transforms}
          />
        ) : null}
        {step === "export" ? (
          <ComponentPickerConfiguration
            kind="export"
            onSelect={changeExport}
            onValuesChange={changeExportValues}
            selected={draft.export?.metadata}
            values={draft.export?.values ?? {}}
          />
        ) : null}
      </div>

      {saveErrorMessage === undefined ? null : (
        <p className="pipeline-builder__save-error" role="alert">{saveErrorMessage}</p>
      )}

      <div className="pipeline-builder__actions">
        <div className="pipeline-builder__actions-nav">
          {previousStep === undefined ? null : (
            <Button onClick={() => setStep(previousStep)} type="button" variant="secondary">
              {t("pipeline.builder.back")}
            </Button>
          )}
          {nextStep === undefined ? (
            <p aria-live="polite" className="pipeline-builder__readiness" role="status">
              {t(isPipelineBuilderDraftComplete(draft) ? "pipeline.builder.readiness.complete" : "pipeline.builder.readiness.incomplete")}
            </p>
          ) : (
            <Button onClick={() => setStep(nextStep)} type="button">
              {t("pipeline.builder.next")}
            </Button>
          )}
        </div>
        {onCreate === undefined && onUpdate === undefined ? null : (
          <Button disabled={!canSave || isSaving} onClick={() => void save()} type="button" variant="secondary">
            {isSaving ? t("pipeline.builder.saving") : t("pipeline.builder.save")}
          </Button>
        )}
      </div>
    </section>
  );
}
