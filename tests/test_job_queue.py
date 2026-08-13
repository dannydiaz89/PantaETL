"""Tests for PostgreSQL worker job claims, heartbeats, and safe release behavior."""

from collections.abc import Mapping
from datetime import UTC, datetime
from uuid import UUID

import pytest

from workers.python.job_queue import PostgresJobQueue

DATABASE_URL = "postgresql://worker:password@localhost:5432/pantaetl"
WORKER_ONE = UUID("123e4567-e89b-12d3-a456-426614174001")
WORKER_TWO = UUID("123e4567-e89b-12d3-a456-426614174002")
JOB_ONE = UUID("123e4567-e89b-12d3-a456-426614174003")
JOB_TWO = UUID("123e4567-e89b-12d3-a456-426614174004")
PIPELINE_ID = UUID("123e4567-e89b-12d3-a456-426614174005")
RUN_ID = UUID("123e4567-e89b-12d3-a456-426614174006")
STEP_ID = UUID("123e4567-e89b-12d3-a456-426614174007")
COMPONENT_ID = UUID("123e4567-e89b-12d3-a456-426614174008")
NOW = datetime(2026, 8, 13, 12, 0, tzinfo=UTC)


class FakeCursor:
    """Capture one queue query and return a scripted PostgreSQL row."""

    def __init__(self, owner: "FakeConnection", row: Mapping[str, object] | None) -> None:
        """Prepare the cursor with its parent connection and result row."""
        self._owner = owner
        self._row = row

    def __enter__(self) -> "FakeCursor":
        """Record cursor opening."""
        self._owner.events.append("cursor_opened")
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Record cursor closing."""
        self._owner.events.append("cursor_closed")

    def execute(self, query: str, parameters: Mapping[str, object]) -> None:
        """Record the query that a worker would send to PostgreSQL."""
        self._owner.queries.append((query, parameters))

    def fetchone(self) -> Mapping[str, object] | None:
        """Return the scripted result of the transition."""
        return self._row


class FakeConnection:
    """Connection double that exposes the transaction boundary used by the queue."""

    def __init__(self, row: Mapping[str, object] | None) -> None:
        """Prepare one transaction result."""
        self.events: list[str] = []
        self.queries: list[tuple[str, Mapping[str, object]]] = []
        self._row = row

    def __enter__(self) -> "FakeConnection":
        """Record the beginning of the short database transaction."""
        self.events.append("transaction_opened")
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Record that the transaction commits before control returns to the worker."""
        self.events.append("transaction_closed")

    def cursor(self, *, row_factory: object) -> FakeCursor:
        """Return a query capture cursor with the configured row result."""
        assert row_factory is not None
        return FakeCursor(self, self._row)


class ScriptedConnections:
    """Return a fresh short-lived fake connection for each queue operation."""

    def __init__(self, rows: list[Mapping[str, object] | None]) -> None:
        """Set results to return in queue-operation order."""
        self._rows = rows
        self.connections: list[FakeConnection] = []

    def __call__(self, _database_url: str) -> FakeConnection:
        """Open the next scripted connection."""
        connection = FakeConnection(self._rows.pop(0))
        self.connections.append(connection)
        return connection


def _job_row(
    job_id: UUID, *, state: str = "running", worker_id: UUID | None = WORKER_ONE
) -> dict[str, object]:
    """Build a database-returning projection compatible with the worker contract."""
    claimed_at = NOW if worker_id is not None else None
    return {
        "id": job_id,
        "pipelineId": PIPELINE_ID,
        "runId": RUN_ID,
        "stepId": STEP_ID,
        "componentId": COMPONENT_ID,
        "state": state,
        "attempt": 1,
        "retryMaxAttempts": 3,
        "retryDelaySeconds": 30,
        "availableAt": NOW,
        "workerId": worker_id,
        "claimedAt": claimed_at,
        "heartbeatAt": claimed_at,
        "completedAt": NOW if state == "failed" else None,
    }


def _queue(rows: list[Mapping[str, object] | None]) -> tuple[PostgresJobQueue, ScriptedConnections]:
    """Create a queue using a deterministic connection factory."""
    connections = ScriptedConnections(rows)
    return PostgresJobQueue(DATABASE_URL, connection_factory=connections), connections


def test_workers_claim_distinct_due_jobs_with_short_skip_locked_transactions() -> None:
    """Use row locking to let separate workers claim different eligible rows."""
    queue, connections = _queue([_job_row(JOB_ONE), _job_row(JOB_TWO, worker_id=WORKER_TWO)])

    first = queue.claim_next(WORKER_ONE, now=NOW)
    second = queue.claim_next(WORKER_TWO, now=NOW)

    assert first is not None and second is not None
    assert {first.id, second.id} == {JOB_ONE, JOB_TWO}
    assert first.claim is not None and first.claim.workerId == WORKER_ONE
    assert second.claim is not None and second.claim.workerId == WORKER_TWO
    assert all(
        connection.events
        == ["transaction_opened", "cursor_opened", "cursor_closed", "transaction_closed"]
        for connection in connections.connections
    )
    claim_query = connections.connections[0].queries[0][0]
    assert "FOR UPDATE SKIP LOCKED" in claim_query
    assert "attempt = job.attempt + 1" in claim_query


def test_claim_returns_no_job_when_nothing_is_eligible() -> None:
    """Leave the queue unchanged when no due queued row can be locked."""
    queue, connections = _queue([None])

    assert queue.claim_next(WORKER_ONE, now=NOW) is None
    assert connections.connections[0].events[-1] == "transaction_closed"


def test_heartbeat_and_release_require_the_current_worker_claim() -> None:
    """Guard liveness and shutdown release transitions with job ownership."""
    queue, connections = _queue(
        [_job_row(JOB_ONE), _job_row(JOB_ONE, state="queued", worker_id=None)]
    )

    heartbeat = queue.heartbeat(JOB_ONE, WORKER_ONE, now=NOW)
    released = queue.release(JOB_ONE, WORKER_ONE, now=NOW)

    assert heartbeat is not None and heartbeat.claim is not None
    assert released is not None and released.state == "queued"
    assert released.claim is None
    heartbeat_query, heartbeat_parameters = connections.connections[0].queries[0]
    release_query, release_parameters = connections.connections[1].queries[0]
    assert "state = 'running' AND worker_id = %(worker_id)s" in heartbeat_query
    assert "state = 'running' AND worker_id = %(worker_id)s" in release_query
    assert heartbeat_parameters["worker_id"] == WORKER_ONE
    assert release_parameters["job_id"] == JOB_ONE


def test_failure_requeues_with_delay_or_completes_after_retry_exhaustion() -> None:
    """Clear claims safely while allowing PostgreSQL to apply the persisted retry policy."""
    queue, connections = _queue(
        [
            _job_row(JOB_ONE, state="queued", worker_id=None),
            _job_row(JOB_TWO, state="failed", worker_id=None),
        ]
    )

    retrying = queue.fail(JOB_ONE, WORKER_ONE, now=NOW)
    terminal = queue.fail(JOB_TWO, WORKER_ONE, now=NOW)

    assert retrying is not None and retrying.state == "queued" and retrying.claim is None
    assert terminal is not None and terminal.state == "failed" and terminal.completedAt == NOW
    failure_query = connections.connections[0].queries[0][0]
    assert "WHEN attempt < retry_max_attempts THEN 'queued'::job_state" in failure_query
    assert "make_interval(secs => retry_delay_seconds)" in failure_query
    assert "worker_id = NULL" in failure_query


@pytest.mark.parametrize("database_url", ["", "https://example.test/database", "mysql://queue"])
def test_queue_rejects_non_postgresql_urls(database_url: str) -> None:
    """Reject an invalid queue configuration before a worker attempts a connection."""
    with pytest.raises(ValueError, match="PostgreSQL"):
        PostgresJobQueue(database_url)


def test_queue_rejects_ambiguous_timestamps() -> None:
    """Avoid implicit local time when selecting due jobs or applying retry delays."""
    queue, _connections = _queue([])

    with pytest.raises(ValueError, match="timezone"):
        queue.claim_next(WORKER_ONE, now=datetime(2026, 8, 13, 12, 0))
