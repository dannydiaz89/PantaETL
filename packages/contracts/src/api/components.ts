import { z } from "zod";

import componentCapabilityCatalog from "../generated/component-capability-catalog.json" with { type: "json" };
import {
  componentKindSchema,
  componentMetadataSchema,
  type ComponentKind,
  type ComponentMetadata,
} from "../components/index.js";

/** Request used to optionally narrow the built-in component catalog by component kind. */
export interface ComponentCapabilityListRequest {
  readonly kind?: ComponentKind;
}

/** Built-in component metadata returned by the control plane. */
export interface ComponentCapabilityListResponse {
  readonly components: readonly ComponentMetadata[];
}

/** Validate an optional component kind filter for the capability collection. */
export const componentCapabilityListRequestSchema = z.strictObject({
  kind: componentKindSchema.optional(),
}) as z.ZodType<ComponentCapabilityListRequest>;

/** Validate the built-in component metadata collection returned by the control plane. */
export const componentCapabilityListResponseSchema = z.strictObject({
  components: z.array(componentMetadataSchema as z.ZodType<ComponentMetadata>),
}) as z.ZodType<ComponentCapabilityListResponse>;

/** Static, canonically validated metadata for every built-in component compiled into this release. */
export const builtInComponentCapabilities = componentCapabilityListResponseSchema.parse({
  components: componentCapabilityCatalog,
}).components;

/** Narrow a validated component catalog to the requested component kind. */
export function filterComponentCapabilities(
  components: readonly ComponentMetadata[],
  kind: ComponentKind | undefined,
): ComponentMetadata[] {
  return kind === undefined ? [...components] : components.filter((component) => component.kind === kind);
}
