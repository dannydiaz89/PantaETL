import { Button, Field, Input } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";

/** Provides the editable overview fields for the selected fixture pipeline. */
export function PipelineOverviewPanel({
  draftName,
  editable,
  onDraftNameChange,
  saved,
}: {
  readonly draftName: string;
  readonly editable: boolean;
  readonly onDraftNameChange: (value: string) => void;
  readonly saved: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="pipeline-tab-panel">
      <Field description={t("pipeline.nameDescription")} label={t("pipeline.name")} required>
        {({ describedBy, id, invalid }) => (
          <Input
            aria-describedby={describedBy}
            aria-invalid={invalid}
            disabled={!editable}
            id={id}
            onChange={(event) => onDraftNameChange(event.target.value)}
            required
            value={draftName}
          />
        )}
      </Field>
      <Button disabled={!editable} type="submit">{t("pipeline.save")}</Button>
      {saved ? <p className="pipeline-save-status" role="status">{t("pipeline.saveSuccess")}</p> : null}
    </div>
  );
}
