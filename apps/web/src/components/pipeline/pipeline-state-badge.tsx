import type { PipelineState } from "@pantaetl/contracts";

import { useI18n } from "../../locale-provider.js";

/** Displays a localized pipeline state using the shared status-token treatment. */
export function PipelineStateBadge({ state }: { readonly state: PipelineState }) {
  const { t } = useI18n();

  return <span className={`pipeline-state pipeline-state--${state}`}>{t(`pipeline.state.${state}`)}</span>;
}
