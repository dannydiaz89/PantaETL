# Pipeline Model

## Core model

**Source → Transform → Export**

Trigger is separate.

## Pipeline state

At minimum:

- draft/configuring;
- enabled;
- disabled;
- running as an execution state.

A pipeline is editable only when it has no active run.

Enabled/disabled is separate from currently running.

## Concurrency

Different pipelines may run concurrently.

A single pipeline has at most one active run.

Additional triggers queue.

## Retry

Pipeline retry restarts from the beginning.

Step-level recovery is not part of the baseline.

## Failure

A branch failure stops the pipeline.

Recoverable malformed records/files may be handled by component logic.

A terminal `completed_with_warnings` state may be used where appropriate.

## Cancellation

Cancellation prevents pending work, signals active work to stop, reaches a terminal cancelled state, and cleans temporary datasets.

## Duplication

Pipeline duplication copies structure/configuration but requires deliberate credential re-entry/rebinding.

## Import/export

Standalone pipeline definitions may be exported.

Imports:

- arrive disabled/draft;
- exclude usable credentials;
- require review;
- fail clearly when required capabilities are missing.

## Ownership

Deleted-user pipelines transfer to an administrator.

Historical metadata may record the previous owner without changing execution behavior.
