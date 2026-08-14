import type { ComponentConfiguration, ComponentMetadata } from "@pantaetl/contracts";
import { Button } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import type { TranslationKey } from "../../locales/en.js";
import { ComponentConfigurationForm } from "./component-configuration-form.js";
import { ComponentLogo } from "./component-logo.js";
import { ComponentCapabilityPicker, type ComponentPickerOptionState } from "./component-picker.js";
import type { PipelineBuilderComponentSelection } from "./pipeline-builder-draft.js";

/** Properties accepted by the Transforms wizard step. */
export interface PipelineBuilderTransformsStepProps {
  /** Determines whether a candidate next Transform is compatible with the current chain, and why not. */
  readonly getOptionState?: (component: ComponentMetadata) => ComponentPickerOptionState;
  /** Adds a new Transform instance at the end of the list. */
  readonly onAdd: (metadata: ComponentMetadata) => void;
  /** Moves one existing Transform earlier or later without changing its identity. */
  readonly onMove: (id: string, direction: "up" | "down") => void;
  /** Removes one existing Transform instance. */
  readonly onRemove: (id: string) => void;
  /** Replaces the non-secret configuration values of one existing Transform instance. */
  readonly onValuesChange: (id: string, values: ComponentConfiguration["values"]) => void;
  /** Currently added Transform instances, in display and execution order. */
  readonly transforms: readonly PipelineBuilderComponentSelection[];
}

/**
 * Presents the catalog of addable Transforms alongside the ordered list already added.
 *
 * Keeping both in view lets the reader judge what the chain currently does before adding
 * to it, while each added Transform keeps its own metadata-driven configuration, remove
 * control, and keyboard-operable reorder controls.
 */
export function PipelineBuilderTransformsStep({ getOptionState, onAdd, onMove, onRemove, onValuesChange, transforms }: PipelineBuilderTransformsStepProps) {
  const { t } = useI18n();

  return (
    <div className="pipeline-builder-transforms">
      <section className="pipeline-builder__section pipeline-builder-transforms__catalog">
        <h2 className="pipeline-builder__section-title">{t("pipeline.builder.section.transform.add")}</h2>
        <ComponentCapabilityPicker getOptionState={getOptionState} kind="transform" onSelect={onAdd} selected={undefined} />
      </section>

      <section className="pipeline-builder__section pipeline-builder-transforms__configured">
        <h2 className="pipeline-builder__section-title">
          {t("pipeline.builder.section.transform.configured")}
          <span className="pipeline-builder__section-subject">{transforms.length}</span>
        </h2>
        {transforms.length === 0 ? (
          <p className="pipeline-builder-transforms__empty">{t("pipeline.builder.transform.empty")}</p>
        ) : (
          <ol className="pipeline-builder-transforms__list">
            {transforms.map((transform, index) => (
              <li className="pipeline-builder-transforms__item" key={transform.id}>
                <div className="pipeline-builder-transforms__item-header">
                  <span aria-hidden="true" className="pipeline-builder__step-index">{index + 1}</span>
                  <ComponentLogo component={transform.metadata} />
                  <strong>{t(transform.metadata.displayNameKey as TranslationKey)}</strong>
                  <div className="pipeline-builder-transforms__item-actions">
                    <Button
                      disabled={index === 0}
                      onClick={() => onMove(transform.id, "up")}
                      type="button"
                      variant="secondary"
                    >
                      {t("pipeline.builder.transform.moveUp")}
                    </Button>
                    <Button
                      disabled={index === transforms.length - 1}
                      onClick={() => onMove(transform.id, "down")}
                      type="button"
                      variant="secondary"
                    >
                      {t("pipeline.builder.transform.moveDown")}
                    </Button>
                    <Button onClick={() => onRemove(transform.id)} type="button" variant="danger">
                      {t("pipeline.builder.transform.remove")}
                    </Button>
                  </div>
                </div>
                <ComponentConfigurationForm
                  metadata={transform.metadata}
                  onChange={(values) => onValuesChange(transform.id, values)}
                  values={transform.values}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
