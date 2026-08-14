import { isPipelineApiError } from "../../data/pipelines/index.js";
import type { LocaleContextValue } from "../../locale-provider.js";

/** Maps structured pipeline API failures to localized messages without retaining server diagnostics. */
export function getPipelineMutationErrorMessage(
  error: unknown,
  t: LocaleContextValue["t"],
): string | undefined {
  if (error === null || error === undefined) return undefined;
  if (!isPipelineApiError(error)) return t("pipeline.mutation.failed");

  switch (error.code) {
    case "pipeline_locked":
      return t("pipeline.mutation.locked");
    case "pipeline_has_run_history":
      return t("pipeline.mutation.hasRunHistory");
    case "pipeline_not_executable":
      return t("pipeline.mutation.notExecutable");
    case "unauthenticated":
      return t("pipeline.mutation.unauthenticated");
    case "network_error":
      return t("pipeline.mutation.network");
    default:
      return t("pipeline.mutation.failed");
  }
}
