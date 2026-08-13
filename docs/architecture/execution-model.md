# Execution Model

## Run lifecycle

```text
Trigger
  |
Create run
  |
Queue Source
  |
Acquire data
  |
Persist temporary Dataset
  |
Transform(s)
  |
Persist temporary Dataset(s)
  |
Export(s)
  |
Commit checkpoint(s)
  |
Mark success
  |
Cleanup temporary Dataset(s)
```

## PostgreSQL queue

Use short claim transactions with row locking such as `FOR UPDATE SKIP LOCKED`.

Do not hold claim transactions during ETL execution.

## Job state

Conceptual states:

- queued;
- running;
- succeeded;
- failed;
- cancelled.

Track:

- attempts;
- retry policy;
- available time;
- claim time;
- worker;
- heartbeat;
- completion/error metadata.

## Checkpoints

Checkpoint shape is Source-defined.

The platform stores checkpoints durably.

Examples:

- page token;
- timestamp;
- last database ID;
- processed file identity/hash.

Checkpoint advancement happens only after complete pipeline success.

## File identity

Use multiple signals where feasible:

- provider/source identity;
- path/key;
- content hash;
- modification metadata.

Changed content becomes eligible for processing again.

## Missed schedules

Missed scheduled executions queue.

Backlog control may be added later if real deployments need it.

## Shutdown

Services stop claiming new work, finish or safely release active work where possible, update state, and avoid hidden stuck work.
