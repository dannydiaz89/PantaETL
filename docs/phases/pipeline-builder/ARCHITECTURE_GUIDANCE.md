# Pipeline Builder Architecture Guidance

## Component metadata drives the builder

Python components already declare `ComponentMetadata`: kind, type, version, translation keys, config fields, input families, and output families. The builder should consume this information rather than duplicating definitions in React.

## Capability catalog

For built-in components, use a generated capability catalog derived from the same Python metadata used by the worker:

```text
Python component metadata → generated catalog JSON → control-plane API → TanStack Query → builder
```

Do not manually maintain a TypeScript component list. Do not make the browser inspect Python. Do not add an HTTP server to every worker solely for metadata discovery. Future plugin runtime discovery is outside this phase.

Recommended API:

```text
GET /api/components
GET /api/components?kind=source
GET /api/components?kind=transform
GET /api/components?kind=export
```

Return the existing `ComponentMetadata` contract.

## Generic configuration renderer

Render controls from `configFields`. Support the metadata field types already present (text, textarea, number, boolean, select, JSON, etc.). Secret fields must never enter ordinary `configuration.values`.

## Builder draft model

A local browser editing model may look conceptually like:

```text
PipelineBuilderDraft
  name
  source?
  transforms[]
  export?
  dirty
```

It is not a persistence model. Convert it to canonical Pipeline steps/edges when saving.

## Stable identities

Preserve existing step IDs when editing/reordering existing components. New steps get new IDs. Reordering does not recreate Transform IDs.

## Linear edge derivation

For the initial builder:

```text
orderedSteps = [source, ...transforms, export]
```

Generate edges between adjacent existing steps. Users never manually edit edges in this phase.

## Compatibility

Reuse `checkComponentCompatibility` and related shared domain utilities. Disable incompatible choices with accessible explanations where possible, and validate the final chain again server-side.

## Draft vs executable validation

Maintain separate concepts: persistable draft vs executable pipeline. If current validation conflates them, introduce separate domain validation functions. Enable must invoke executable validation.

## Secrets

For a configured secret, show only configured state. Leaving it untouched preserves the binding; entering a replacement uses the write-only secret path.

## Component-specific custom UI

Do not add component-type-specific React conditionals when metadata can represent the field. Extend ComponentMetadata deliberately if a current built-in needs a missing generic capability.

## No graph canvas

The persistence model is a graph; the initial editor is a linear wizard/list interface.
