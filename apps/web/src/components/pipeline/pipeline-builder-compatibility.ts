import type { ComponentMetadata } from "@pantaetl/contracts";
import { checkComponentCompatibility } from "@pantaetl/pipeline";

import type { ComponentPickerOptionState } from "./component-picker.js";

/**
 * Builds a picker option-state resolver that disables components incompatible with the
 * current chain's last step, reusing the shared domain compatibility check. Everything
 * stays enabled when there is no upstream component yet to check against, since nothing
 * is known to be incompatible before then.
 */
export function createPipelineBuilderCompatibilityResolver(
  chainTail: ComponentMetadata | undefined,
  incompatibleReason: string,
): (component: ComponentMetadata) => ComponentPickerOptionState {
  return (component) => {
    if (chainTail === undefined) return { disabled: false, reason: undefined };

    const { compatible } = checkComponentCompatibility(chainTail, component);
    return compatible ? { disabled: false, reason: undefined } : { disabled: true, reason: incompatibleReason };
  };
}
