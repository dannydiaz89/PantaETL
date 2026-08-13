"""Source checkpoint candidates and PostgreSQL commit lifecycle management."""

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol, cast
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .generated.source_execution_request import SourceExecutionRequest
from .job_queue import ConnectionFactory, JobQueueConnection, validate_database_url

type CheckpointValue = (
    None | bool | float | int | str | list["CheckpointValue"] | dict[str, "CheckpointValue"]
)


class CheckpointValueError(ValueError):
    """Raised when a Source candidate cannot be represented as portable JSON."""


@dataclass(frozen=True, slots=True)
class CheckpointCandidate:
    """A Source-specific value eligible for commit only after full run success."""

    pipeline_id: UUID
    source_component_id: UUID
    value: CheckpointValue


class CheckpointStore(Protocol):
    """Durable boundary for loading and conditionally committing Source checkpoints."""

    def load(self, pipeline_id: UUID, source_component_id: UUID) -> CheckpointValue | None:
        """Load the latest committed checkpoint for one Source in a pipeline."""

    def commit_if_run_succeeded(
        self, candidate: CheckpointCandidate, run_id: UUID, *, now: datetime | None = None
    ) -> bool:
        """Persist a candidate only if the complete owning run is successfully terminal."""


_LOAD_CHECKPOINT = """
SELECT checkpoint
FROM source_checkpoints
WHERE pipeline_id = %(pipeline_id)s AND source_component_id = %(source_component_id)s
"""

_LOCK_PIPELINE = """
SELECT id
FROM pipelines
WHERE id = %(pipeline_id)s
FOR UPDATE
"""

_COMMIT_CHECKPOINT_IF_RUN_SUCCEEDED = """
WITH successful_run AS (
  SELECT id
  FROM runs
  WHERE id = %(run_id)s
    AND pipeline_id = %(pipeline_id)s
    AND state IN ('succeeded', 'completed_with_warnings')
)
INSERT INTO source_checkpoints (
  pipeline_id,
  source_component_id,
  checkpoint,
  updated_at
)
SELECT
  %(pipeline_id)s,
  %(source_component_id)s,
  %(checkpoint)s,
  %(now)s
FROM successful_run
ON CONFLICT (pipeline_id, source_component_id)
DO UPDATE SET checkpoint = EXCLUDED.checkpoint, updated_at = EXCLUDED.updated_at
RETURNING pipeline_id
"""


class PostgresCheckpointStore:
    """Persist Source checkpoints only after PostgreSQL confirms full run completion.

    A pipeline row lock serializes commit attempts for the same pipeline. The lock
    is held only for the read-and-upsert transaction; Source execution has already
    completed before this store is called.
    """

    def __init__(
        self,
        database_url: str,
        *,
        connection_factory: ConnectionFactory | None = None,
    ) -> None:
        """Configure checkpoint storage without opening a database connection."""
        self._database_url = validate_database_url(database_url)
        self._connection_factory = connection_factory or _connect

    def load(self, pipeline_id: UUID, source_component_id: UUID) -> CheckpointValue | None:
        """Read the latest durable checkpoint without creating an empty record."""
        with self._connection_factory(self._database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    _LOAD_CHECKPOINT,
                    {"pipeline_id": pipeline_id, "source_component_id": source_component_id},
                )
                row = cursor.fetchone()

        return None if row is None else _validate_checkpoint_value(row["checkpoint"])

    def commit_if_run_succeeded(
        self, candidate: CheckpointCandidate, run_id: UUID, *, now: datetime | None = None
    ) -> bool:
        """Serialize same-pipeline updates and commit only a successful run's candidate."""
        timestamp = _checkpoint_time(now)
        with self._connection_factory(self._database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(_LOCK_PIPELINE, {"pipeline_id": candidate.pipeline_id})
                if cursor.fetchone() is None:
                    return False

                cursor.execute(
                    _COMMIT_CHECKPOINT_IF_RUN_SUCCEEDED,
                    {
                        "pipeline_id": candidate.pipeline_id,
                        "source_component_id": candidate.source_component_id,
                        "run_id": run_id,
                        "checkpoint": Jsonb(candidate.value),
                        "now": timestamp,
                    },
                )
                return cursor.fetchone() is not None


class SourceCheckpointLifecycle:
    """Hold one Source's checkpoint candidate outside durable state until run success."""

    def __init__(
        self, store: CheckpointStore, pipeline_id: UUID, source_component_id: UUID
    ) -> None:
        """Bind a Source checkpoint stream to its pipeline ownership identity."""
        self._store = store
        self._pipeline_id = pipeline_id
        self._source_component_id = source_component_id
        self._candidate: CheckpointCandidate | None = None

    def load(self) -> CheckpointValue | None:
        """Load the Source's last committed checkpoint before acquisition begins."""
        return self._store.load(self._pipeline_id, self._source_component_id)

    def propose(self, value: object) -> CheckpointCandidate:
        """Record a Source-specific candidate without advancing durable state."""
        candidate = CheckpointCandidate(
            pipeline_id=self._pipeline_id,
            source_component_id=self._source_component_id,
            value=_validate_checkpoint_value(value),
        )
        self._candidate = candidate
        return candidate

    def commit_after_run_success(self, run_id: UUID, *, now: datetime | None = None) -> bool:
        """Commit the pending candidate only if PostgreSQL verifies complete run success."""
        if self._candidate is None:
            return False
        return self._store.commit_if_run_succeeded(self._candidate, run_id, now=now)

    def discard(self) -> None:
        """Discard an uncommitted candidate after failure or cancellation."""
        self._candidate = None


class RunCheckpointCoordinator:
    """Bind Source checkpoint candidates to one run until terminal execution succeeds.

    Sources create their lifecycle through this coordinator before acquisition. The
    worker commits candidates only after it has recorded full run success, while a
    failed run discards every candidate without touching durable checkpoints.
    """

    def __init__(self, store: CheckpointStore) -> None:
        """Configure durable checkpoint storage without retaining run-specific state."""
        self._store = store
        self._lifecycles: dict[UUID, list[SourceCheckpointLifecycle]] = {}

    def create_lifecycle(self, request: SourceExecutionRequest) -> SourceCheckpointLifecycle:
        """Create and retain one Source lifecycle for the request's owning run."""
        lifecycle = SourceCheckpointLifecycle(
            self._store,
            request.pipelineId,
            request.componentId,
        )
        self._lifecycles.setdefault(request.runId, []).append(lifecycle)
        return lifecycle

    def commit_after_run_success(self, run_id: UUID) -> bool:
        """Commit all deferred candidates after the worker records run success."""
        lifecycles = self._lifecycles.pop(run_id, [])
        committed = False
        for lifecycle in lifecycles:
            committed = lifecycle.commit_after_run_success(run_id) or committed
        return committed

    def discard_run(self, run_id: UUID) -> None:
        """Forget every pending candidate when any component in the run fails."""
        for lifecycle in self._lifecycles.pop(run_id, []):
            lifecycle.discard()


def _connect(database_url: str) -> JobQueueConnection:
    """Open one PostgreSQL connection for a bounded checkpoint transaction."""
    return cast(JobQueueConnection, psycopg.connect(database_url))


def _checkpoint_time(value: datetime | None) -> datetime:
    """Return a UTC commit time and reject ambiguous wall-clock input."""
    timestamp = value or datetime.now(UTC)
    if timestamp.tzinfo is None:
        raise ValueError("Checkpoint timestamps must include a timezone.")
    return timestamp


def _validate_checkpoint_value(value: object) -> CheckpointValue:
    """Copy a Source value through JSON serialization before persisting it as JSONB."""
    try:
        serialized = json.dumps(value, allow_nan=False, separators=(",", ":"))
        return cast(CheckpointValue, json.loads(serialized))
    except (TypeError, ValueError, json.JSONDecodeError) as error:
        raise CheckpointValueError("Source checkpoints must be JSON-compatible.") from error
