# Workstream: Application Setup

## Purpose

This workstream creates the complete PantaETL application topology before detailed contracts and product features are implemented.

The goal is to make every planned runtime and package boundary real in the repository so contracts can be designed against actual consumers.

## Owns

- core monorepo application topology;
- service/package scaffolds;
- Docker Compose development topology;
- shared skeleton configuration;
- skeleton health/start/build behavior;
- application-level CI validation.

## Planned runtime boundaries

```text
apps/
  web/
  scheduler/
  garbage-collector/

workers/
  python/

packages/
  contracts/
  database/
  ui/
  config/
  logging/
  pipeline/
```

## Does not own

- detailed business/domain contracts;
- database entity implementation;
- ETL components;
- production auth behavior;
- design-system component implementation;
- scheduler algorithms;
- worker job execution.

## Key rule

Scaffolding must create real ownership boundaries without filling them with speculative feature code.

## Acceptance outcome

At the end of this workstream:

- all core apps/services/packages exist;
- the web scaffold runs;
- TypeScript services start at skeleton level;
- Python worker starts at skeleton level;
- Docker Compose expresses the topology;
- CI can validate the skeleton;
- contracts can be designed with known consumers;
- frontend and backend agents can later work in parallel.
