import { useState } from "react";

import { Button, Check, Field, Icon, Input } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import type { TranslationKey } from "../../locales/en.js";
import {
  createEmptyPipelineBuilderDraft,
  nextPipelineBuilderStep,
  PIPELINE_BUILDER_STEPS,
  previousPipelineBuilderStep,
  updatePipelineBuilderDraft,
  type PipelineBuilderDraft,
  type PipelineBuilderStep,
} from "./pipeline-builder-draft.js";

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
  /** Seeds the wizard at a specific stage instead of the first stage. */
  readonly initialStep?: PipelineBuilderStep;
  /** Notified whenever the local draft changes, for callers that persist or preview it. */
  readonly onDraftChange?: (draft: PipelineBuilderDraft) => void;
}

/**
 * Three-step Source/Transforms/Export pipeline creation shell.
 *
 * Owns only the local in-progress draft and step navigation; each stage's
 * component selection and configuration UI is supplied by later work and
 * currently renders a placeholder description.
 */
export function PipelineBuilderWizard({ initialDraft, initialStep, onDraftChange }: PipelineBuilderWizardProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<PipelineBuilderDraft>(() => initialDraft ?? createEmptyPipelineBuilderDraft());
  const [step, setStep] = useState<PipelineBuilderStep>(initialStep ?? PIPELINE_BUILDER_STEPS[0]);
  const currentIndex = PIPELINE_BUILDER_STEPS.indexOf(step);
  const nextStep = nextPipelineBuilderStep(step);
  const previousStep = previousPipelineBuilderStep(step);

  function changeName(name: string): void {
    setDraft((current) => {
      const next = updatePipelineBuilderDraft(current, { name });
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
      </div>

      <div className="pipeline-builder__actions">
        {previousStep === undefined ? null : (
          <Button onClick={() => setStep(previousStep)} type="button" variant="secondary">
            {t("pipeline.builder.back")}
          </Button>
        )}
        {nextStep === undefined ? null : (
          <Button onClick={() => setStep(nextStep)} type="button">
            {t("pipeline.builder.next")}
          </Button>
        )}
      </div>
    </section>
  );
}
