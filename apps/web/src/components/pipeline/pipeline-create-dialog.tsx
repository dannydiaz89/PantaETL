import { useState, type FormEvent } from "react";

import type { PipelineCreateRequest } from "@pantaetl/contracts";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Field, Input } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import { createPipelineDraft } from "./pipeline-draft.js";

/** Opens a focused form that creates a non-secret source-to-export pipeline draft. */
export function PipelineCreateDialog({
  errorMessage,
  isCreating,
  onCreate,
}: {
  readonly errorMessage: string | undefined;
  readonly isCreating: boolean;
  readonly onCreate: (request: PipelineCreateRequest, onSuccess: () => void) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [inputFilePath, setInputFilePath] = useState("input.csv");
  const [artifactFileName, setArtifactFileName] = useState("output.csv");
  const [submitted, setSubmitted] = useState(false);
  const nameError = submitted && name.trim().length === 0 ? t("pipeline.create.nameRequired") : undefined;
  const inputFileError = submitted && inputFilePath.trim().length === 0 ? t("pipeline.create.inputRequired") : undefined;
  const artifactFileError = submitted && artifactFileName.trim().length === 0 ? t("pipeline.create.artifactRequired") : undefined;

  function reset(): void {
    setName("");
    setInputFilePath("input.csv");
    setArtifactFileName("output.csv");
    setSubmitted(false);
  }

  function changeOpen(nextOpen: boolean): void {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSubmitted(true);
    if (name.trim().length === 0 || inputFilePath.trim().length === 0 || artifactFileName.trim().length === 0) return;

    onCreate(createPipelineDraft({ artifactFileName, inputFilePath, name }), () => changeOpen(false));
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button>{t("pipeline.create.open")}</Button>
      </DialogTrigger>
      <DialogContent aria-describedby="pipeline-create-description" aria-labelledby="pipeline-create-title" closeLabel={t("pipeline.dialog.close")}>
        <DialogTitle id="pipeline-create-title">{t("pipeline.create.title")}</DialogTitle>
        <DialogDescription id="pipeline-create-description">{t("pipeline.create.description")}</DialogDescription>
        <form className="pipeline-dialog-form" onSubmit={submit}>
          <Field error={nameError} label={t("pipeline.name")} required>
            {({ describedBy, id, invalid }) => (
              <Input
                aria-describedby={describedBy}
                aria-invalid={invalid}
                autoFocus
                disabled={isCreating}
                id={id}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            )}
          </Field>
          <Field description={t("pipeline.create.inputDescription")} error={inputFileError} label={t("pipeline.create.input")} required>
            {({ describedBy, id, invalid }) => (
              <Input
                aria-describedby={describedBy}
                aria-invalid={invalid}
                disabled={isCreating}
                id={id}
                onChange={(event) => setInputFilePath(event.target.value)}
                required
                value={inputFilePath}
              />
            )}
          </Field>
          <Field description={t("pipeline.create.artifactDescription")} error={artifactFileError} label={t("pipeline.create.artifact")} required>
            {({ describedBy, id, invalid }) => (
              <Input
                aria-describedby={describedBy}
                aria-invalid={invalid}
                disabled={isCreating}
                id={id}
                onChange={(event) => setArtifactFileName(event.target.value)}
                required
                value={artifactFileName}
              />
            )}
          </Field>
          {errorMessage === undefined ? null : <p className="pipeline-mutation-error" role="alert">{errorMessage}</p>}
          <Button disabled={isCreating} type="submit">
            {isCreating ? t("pipeline.create.creating") : t("pipeline.create.submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
