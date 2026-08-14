import { Button, Checkbox, Field, Input, Select } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import type { TranslationKey } from "../../locales/en.js";
import {
  cronFromFriendlySchedule,
  friendlyScheduleFromCron,
  type PipelineScheduleFrequency,
  type PipelineScheduleTriggerDraft,
  type PipelineTriggerDraft,
} from "./pipeline-trigger-draft.js";

const DAY_OF_WEEK_KEYS: readonly TranslationKey[] = [
  "pipeline.trigger.dayOfWeek.sunday",
  "pipeline.trigger.dayOfWeek.monday",
  "pipeline.trigger.dayOfWeek.tuesday",
  "pipeline.trigger.dayOfWeek.wednesday",
  "pipeline.trigger.dayOfWeek.thursday",
  "pipeline.trigger.dayOfWeek.friday",
  "pipeline.trigger.dayOfWeek.saturday",
];

/** IANA timezone identifiers offered by the browser, falling back to a minimal safe set. */
function availableTimezones(): readonly string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

/** Properties accepted by the editable pipeline trigger panel. */
export interface PipelineTriggerEditorProps {
  /** True while the pipeline is not editable (queued or running); disables every control. */
  readonly disabled: boolean;
  /** Current local trigger editing state. */
  readonly draft: PipelineTriggerDraft;
  /** Adds a new default Schedule trigger. */
  readonly onAddSchedule: () => void;
  /** Toggles whether the pipeline can be started manually. */
  readonly onChangeManualEnabled: (enabled: boolean) => void;
  /** Replaces one Schedule trigger's fields, matched by its draft-local id. */
  readonly onChangeSchedule: (localId: string, changes: Partial<Omit<PipelineScheduleTriggerDraft, "localId">>) => void;
  /** Removes one Schedule trigger. */
  readonly onRemoveSchedule: (localId: string) => void;
}

/**
 * Edits a pipeline's manual and scheduled triggers with friendly common-schedule controls,
 * falling back to raw cron only for patterns the friendly controls do not model. Trigger
 * changes are not a fourth wizard stage; this panel only appears in the existing pipeline
 * editor's Trigger tab for an idle pipeline.
 */
export function PipelineTriggerEditor({
  disabled,
  draft,
  onAddSchedule,
  onChangeManualEnabled,
  onChangeSchedule,
  onRemoveSchedule,
}: PipelineTriggerEditorProps) {
  const { t } = useI18n();

  return (
    <div className="pipeline-trigger-editor">
      <Checkbox
        checked={draft.manualEnabled}
        description={t("pipeline.trigger.manual.description")}
        disabled={disabled}
        label={t("pipeline.trigger.manual.label")}
        onCheckedChange={(checked) => onChangeManualEnabled(checked === true)}
      />

      <div className="pipeline-trigger-editor__schedules">
        <div className="pipeline-trigger-editor__schedules-heading">
          <h3>{t("pipeline.trigger.schedule.heading")}</h3>
          <Button disabled={disabled} onClick={onAddSchedule} type="button" variant="secondary">
            {t("pipeline.trigger.schedule.add")}
          </Button>
        </div>
        {draft.schedules.length === 0 ? (
          <p className="pipeline-trigger-editor__schedules-empty">{t("pipeline.trigger.schedule.empty")}</p>
        ) : (
          <ol className="pipeline-trigger-editor__schedule-list">
            {draft.schedules.map((schedule) => (
              <li className="pipeline-trigger-editor__schedule" key={schedule.localId}>
                <PipelineScheduleTriggerFields
                  disabled={disabled}
                  onChange={(changes) => onChangeSchedule(schedule.localId, changes)}
                  onRemove={() => onRemoveSchedule(schedule.localId)}
                  schedule={schedule}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/** Edits one Schedule trigger's enabled state, timezone, and friendly or raw cron shape. */
function PipelineScheduleTriggerFields({
  disabled,
  onChange,
  onRemove,
  schedule,
}: {
  readonly disabled: boolean;
  readonly onChange: (changes: Partial<Omit<PipelineScheduleTriggerDraft, "localId">>) => void;
  readonly onRemove: () => void;
  readonly schedule: PipelineScheduleTriggerDraft;
}) {
  const { t } = useI18n();
  const friendly = friendlyScheduleFromCron(schedule.cron);

  function changeFrequency(frequency: PipelineScheduleFrequency): void {
    const cron = cronFromFriendlySchedule(
      frequency === "custom"
        ? { cron: schedule.cron, frequency }
        : frequency === "hourly"
          ? { frequency, minute: 0 }
          : frequency === "daily"
            ? { frequency, hour: 0, minute: 0 }
            : { dayOfWeek: 1, frequency, hour: 0, minute: 0 },
    );
    onChange({ cron });
  }

  return (
    <div className="pipeline-trigger-editor__schedule-fields">
      <div className="pipeline-trigger-editor__schedule-header">
        <Checkbox
          checked={schedule.enabled}
          disabled={disabled}
          label={t("pipeline.trigger.schedule.enabled")}
          onCheckedChange={(checked) => onChange({ enabled: checked === true })}
        />
        <Button disabled={disabled} onClick={onRemove} type="button" variant="danger">
          {t("pipeline.trigger.schedule.remove")}
        </Button>
      </div>

      <Field label={t("pipeline.trigger.frequency.label")}>
        {({ id }) => (
          <Select
            disabled={disabled}
            id={id}
            onValueChange={(value) => changeFrequency(value as PipelineScheduleFrequency)}
            options={[
              { label: t("pipeline.trigger.frequency.hourly"), value: "hourly" },
              { label: t("pipeline.trigger.frequency.daily"), value: "daily" },
              { label: t("pipeline.trigger.frequency.weekly"), value: "weekly" },
              { label: t("pipeline.trigger.frequency.custom"), value: "custom" },
            ]}
            placeholder={t("pipeline.trigger.frequency.label")}
            value={friendly.frequency}
          />
        )}
      </Field>

      {friendly.frequency === "hourly" ? (
        <Field label={t("pipeline.trigger.minute.label")}>
          {({ id }) => (
            <Input
              disabled={disabled}
              id={id}
              max={59}
              min={0}
              onChange={(event) => onChange({ cron: cronFromFriendlySchedule({ frequency: "hourly", minute: Number(event.target.value) }) })}
              type="number"
              value={friendly.minute}
            />
          )}
        </Field>
      ) : null}

      {friendly.frequency === "daily" ? (
        <>
          <Field label={t("pipeline.trigger.hour.label")}>
            {({ id }) => (
              <Input
                disabled={disabled}
                id={id}
                max={23}
                min={0}
                onChange={(event) => onChange({ cron: cronFromFriendlySchedule({ frequency: "daily", hour: Number(event.target.value), minute: friendly.minute }) })}
                type="number"
                value={friendly.hour}
              />
            )}
          </Field>
          <Field label={t("pipeline.trigger.minute.label")}>
            {({ id }) => (
              <Input
                disabled={disabled}
                id={id}
                max={59}
                min={0}
                onChange={(event) => onChange({ cron: cronFromFriendlySchedule({ frequency: "daily", hour: friendly.hour, minute: Number(event.target.value) }) })}
                type="number"
                value={friendly.minute}
              />
            )}
          </Field>
        </>
      ) : null}

      {friendly.frequency === "weekly" ? (
        <>
          <Field label={t("pipeline.trigger.dayOfWeek.label")}>
            {({ id }) => (
              <Select
                disabled={disabled}
                id={id}
                onValueChange={(value) => onChange({
                  cron: cronFromFriendlySchedule({ dayOfWeek: Number(value), frequency: "weekly", hour: friendly.hour, minute: friendly.minute }),
                })}
                options={DAY_OF_WEEK_KEYS.map((key, index) => ({ label: t(key), value: String(index) }))}
                placeholder={t("pipeline.trigger.dayOfWeek.label")}
                value={String(friendly.dayOfWeek)}
              />
            )}
          </Field>
          <Field label={t("pipeline.trigger.hour.label")}>
            {({ id }) => (
              <Input
                disabled={disabled}
                id={id}
                max={23}
                min={0}
                onChange={(event) => onChange({
                  cron: cronFromFriendlySchedule({ dayOfWeek: friendly.dayOfWeek, frequency: "weekly", hour: Number(event.target.value), minute: friendly.minute }),
                })}
                type="number"
                value={friendly.hour}
              />
            )}
          </Field>
          <Field label={t("pipeline.trigger.minute.label")}>
            {({ id }) => (
              <Input
                disabled={disabled}
                id={id}
                max={59}
                min={0}
                onChange={(event) => onChange({
                  cron: cronFromFriendlySchedule({ dayOfWeek: friendly.dayOfWeek, frequency: "weekly", hour: friendly.hour, minute: Number(event.target.value) }),
                })}
                type="number"
                value={friendly.minute}
              />
            )}
          </Field>
        </>
      ) : null}

      {friendly.frequency === "custom" ? (
        <Field label={t("pipeline.trigger.cron")}>
          {({ id }) => (
            <Input
              disabled={disabled}
              id={id}
              onChange={(event) => onChange({ cron: event.target.value })}
              value={friendly.cron}
            />
          )}
        </Field>
      ) : null}

      <Field label={t("pipeline.trigger.timezone")}>
        {({ id }) => (
          <Select
            disabled={disabled}
            id={id}
            onValueChange={(value) => onChange({ timezone: value })}
            options={availableTimezones().map((timezone) => ({ label: timezone, value: timezone }))}
            placeholder={t("pipeline.trigger.timezone")}
            value={schedule.timezone}
          />
        )}
      </Field>
    </div>
  );
}
