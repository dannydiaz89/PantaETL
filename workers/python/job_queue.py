"""PostgreSQL-backed short transactions for claiming and updating worker jobs."""

from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Protocol, cast
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from .generated import Job


class JobQueueConnection(Protocol):
    """Minimal connection boundary used by short worker queue transactions."""

    def __enter__(self) -> "JobQueueConnection":
        """Open the transaction context."""

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Commit or roll back the transaction and close the connection."""

    def cursor(self, *, row_factory: object) -> "JobQueueCursor":
        """Open a cursor for one short queue operation."""


class JobQueueCursor(Protocol):
    """Minimal cursor boundary for the queue's parameterized SQL statements."""

    def __enter__(self) -> "JobQueueCursor":
        """Open the cursor context."""

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Close the cursor context."""

    def execute(self, query: str, parameters: Mapping[str, object]) -> None:
        """Execute one parameterized query."""

    def fetchone(self) -> Mapping[str, object] | None:
        """Return the sole row updated by one queue transition."""


ConnectionFactory = Callable[[str], JobQueueConnection]

_RETURNING_JOB = """
RETURNING
  id,
  pipeline_id AS "pipelineId",
  run_id AS "runId",
  run_step_id AS "stepId",
  component_id AS "componentId",
  state::text AS state,
  attempt,
  retry_max_attempts AS "retryMaxAttempts",
  retry_delay_seconds AS "retryDelaySeconds",
  available_at AS "availableAt",
  worker_id AS "workerId",
  claimed_at AS "claimedAt",
  heartbeat_at AS "heartbeatAt",
  completed_at AS "completedAt"
"""

_CLAIM_NEXT = f"""
WITH candidate AS (
  SELECT id
  FROM jobs
  WHERE state = 'queued' AND available_at <= %(now)s
  ORDER BY available_at ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE jobs AS job
SET
  state = 'running',
  worker_id = %(worker_id)s,
  claimed_at = %(now)s,
  heartbeat_at = %(now)s,
  attempt = job.attempt + 1
FROM candidate
WHERE job.id = candidate.id AND job.state = 'queued'
{_RETURNING_JOB}
"""

_HEARTBEAT = f"""
UPDATE jobs
SET heartbeat_at = %(now)s
WHERE id = %(job_id)s AND state = 'running' AND worker_id = %(worker_id)s
{_RETURNING_JOB}
"""

_RELEASE = f"""
UPDATE jobs
SET
  state = 'queued',
  available_at = %(now)s,
  worker_id = NULL,
  claimed_at = NULL,
  heartbeat_at = NULL
WHERE id = %(job_id)s AND state = 'running' AND worker_id = %(worker_id)s
{_RETURNING_JOB}
"""

_FAIL_OR_REQUEUE = f"""
UPDATE jobs
SET
  state = CASE
    WHEN attempt < retry_max_attempts THEN 'queued'::job_state
    ELSE 'failed'::job_state
  END,
  available_at = CASE
    WHEN attempt < retry_max_attempts
      THEN %(now)s + make_interval(secs => retry_delay_seconds)
    ELSE available_at
  END,
  worker_id = NULL,
  claimed_at = NULL,
  heartbeat_at = NULL,
  completed_at = CASE
    WHEN attempt < retry_max_attempts THEN NULL
    ELSE %(now)s
  END
WHERE id = %(job_id)s AND state = 'running' AND worker_id = %(worker_id)s
{_RETURNING_JOB}
"""


class PostgresJobQueue:
    """Claim and update jobs through operations that commit before ETL can begin.

    Each method opens, uses, and closes a PostgreSQL connection before returning.
    That confines a row lock to exactly one queue transition rather than a worker's
    potentially long-running execution period.
    """

    def __init__(
        self,
        database_url: str,
        *,
        connection_factory: ConnectionFactory | None = None,
    ) -> None:
        """Configure a queue for one PostgreSQL database without opening a connection."""
        self._database_url = _validate_database_url(database_url)
        self._connection_factory = connection_factory or _connect

    def claim_next(self, worker_id: UUID, *, now: datetime | None = None) -> Job | None:
        """Atomically claim one due queued job with `SKIP LOCKED` concurrency safety."""
        return self._transition(_CLAIM_NEXT, {"worker_id": worker_id, "now": _queue_time(now)})

    def heartbeat(
        self, job_id: UUID, worker_id: UUID, *, now: datetime | None = None
    ) -> Job | None:
        """Refresh an active claim only when it is still owned by this worker."""
        return self._transition(
            _HEARTBEAT,
            {"job_id": job_id, "worker_id": worker_id, "now": _queue_time(now)},
        )

    def release(self, job_id: UUID, worker_id: UUID, *, now: datetime | None = None) -> Job | None:
        """Return a worker-owned active job to the queue for safe shutdown recovery."""
        return self._transition(
            _RELEASE,
            {"job_id": job_id, "worker_id": worker_id, "now": _queue_time(now)},
        )

    def fail(self, job_id: UUID, worker_id: UUID, *, now: datetime | None = None) -> Job | None:
        """Requeue a worker-owned failure when attempts remain, else mark it terminal."""
        return self._transition(
            _FAIL_OR_REQUEUE,
            {"job_id": job_id, "worker_id": worker_id, "now": _queue_time(now)},
        )

    def _transition(self, query: str, parameters: Mapping[str, object]) -> Job | None:
        """Run one state transition in a transaction that ends before returning work."""
        with self._connection_factory(self._database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(query, parameters)
                row = cursor.fetchone()

        return _job_from_row(row) if row is not None else None


def _connect(database_url: str) -> JobQueueConnection:
    """Open a synchronous PostgreSQL connection for a single queue transition."""
    return cast(JobQueueConnection, psycopg.connect(database_url))


def _queue_time(value: datetime | None) -> datetime:
    """Return a UTC timestamp and reject ambiguous caller-supplied wall-clock values."""
    timestamp = value or datetime.now(UTC)
    if timestamp.tzinfo is None:
        raise ValueError("Queue timestamps must include a timezone.")
    return timestamp


def _validate_database_url(database_url: str) -> str:
    """Reject missing or non-PostgreSQL connection URLs without exposing credentials."""
    normalized = database_url.strip()
    if normalized.startswith(("postgres://", "postgresql://")):
        return normalized
    raise ValueError("A PostgreSQL database URL is required for the worker queue.")


def _job_from_row(row: Mapping[str, object]) -> Job:
    """Translate a queue-row projection to the generated worker Job contract."""
    claim = _claim_from_row(row)
    payload: dict[str, object] = {
        "contractVersion": "v1",
        "id": row["id"],
        "pipelineId": row["pipelineId"],
        "runId": row["runId"],
        "stepId": row["stepId"],
        "componentId": row["componentId"],
        "state": row["state"],
        "attempt": row["attempt"],
        "retryPolicy": {
            "maxAttempts": row["retryMaxAttempts"],
            "retryDelaySeconds": row["retryDelaySeconds"],
        },
        "availableAt": row["availableAt"],
        "completedAt": row["completedAt"],
    }
    if claim is not None:
        payload["claim"] = claim
    return Job.model_validate(payload)


def _claim_from_row(row: Mapping[str, object]) -> dict[str, object] | None:
    """Build a claim only from complete queue claim metadata."""
    claim_values = (row["workerId"], row["claimedAt"], row["heartbeatAt"])
    if all(value is None for value in claim_values):
        return None
    if any(value is None for value in claim_values):
        raise ValueError("Database job claim metadata is incomplete.")
    return {
        "workerId": row["workerId"],
        "claimedAt": row["claimedAt"],
        "heartbeatAt": row["heartbeatAt"],
    }
