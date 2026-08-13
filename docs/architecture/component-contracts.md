# Component Contracts

## Registries

Conceptually:

- SourceRegistry;
- TransformationRegistry;
- ExportRegistry.

Avoid central switch statements.

## Component metadata

Each component should expose:

- stable identifier;
- display translation key;
- description translation key;
- version;
- configuration schema;
- input contract;
- output contract;
- executor;
- execution characteristics when needed.

## Broad data contracts

Prefer useful structural families:

- any;
- document;
- tabular;
- file.

Runtime validation may be more specific.

## Source

Produces a Dataset.

May use:

- network;
- secrets;
- query parameters;
- headers;
- authentication;
- checkpoints.

## Transform

Consumes/produces Datasets.

Does not receive connection credentials.

Normal Transform contract does not provide network access.

Developers should add transforms in focused files/modules.

Suggested organization:

```text
transforms/
  columns/
  rows/
  values/
  aggregate/
  document/
```

## Export

Consumes a Dataset.

May use destination secrets/network.

Each Export owns safe retry semantics appropriate to its destination.

## Plugins

Deferred.

Current interfaces should not prevent future plugins or sandboxing.
