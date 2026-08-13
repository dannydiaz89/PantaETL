# Pipeline Builder Phase

This phase turns the existing pipeline CRUD/control-plane foundation into the actual PantaETL creation experience.

The user-facing model is **Source → Transform(s) → Export**. Pipeline creation is a guided three-step wizard: Source, Transforms, Export. The underlying persistence model remains the canonical Pipeline graph (`steps`, `edges`, configuration, secret bindings, state).

## Product requirements

- Do not hardcode CSV as the pipeline type.
- Do not hardcode component-specific forms when metadata can drive them.
- Available choices come from registered PantaETL component metadata.
- Secret fields are write-only.
- Use the existing Pipeline contract and CRUD API.
- A draft may be incomplete; enable/run requires a complete valid pipeline.
- Initial UI supports one Source, zero or more Transforms, and one Export.
- Trigger remains pipeline-owned but is not a fourth creation step.
- Do not introduce a visual node/edge canvas.
- Accessibility, localization, design-system, dark/light mode, and no-emoji rules remain mandatory.

## Existing code to reuse

- Python Source/Transform/Export registries and ComponentMetadata.
- Metadata-driven Python configuration validation.
- Component input/output families.
- `@pantaetl/pipeline` compatibility utilities.
- Canonical Pipeline steps/edges.
- Pipeline CRUD APIs and TanStack Query layer.
- Pipeline edit-lock behavior.
- Existing decomposed pipeline components.

`UI_REFERENCE.png`, when present, is the selected direction, not a pixel-perfect specification.
