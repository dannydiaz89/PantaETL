"""Tests for cooperative worker cancellation and Dataset cleanup signaling."""

from datetime import UTC, datetime
from typing import cast
from uuid import UUID

import pytest

from workers.python.cancellation import (
    CancellationRequested,
    CooperativeCancellation,
    DatasetCleanupEligibility,
    JobClaimLost,
    PostgresDatasetCleanupEligibility,
)
from workers.python.generated import Job
from workers.python.job_queue import ConnectionFactory

WORKER_ID = UUID("123e4567-e89b-12d3-a456-426614174001")
JOB_ID = UUID("123e4567-e89b-12d3-a456-426614174002")
PENDING_JOB_ID = UUID("123e4567-e89b-12d3-a456-426614174003")
PIPELINE_ID = UUID("123e4567-e89b-12d3-a456-426614174004")
RUN_ID = UUID("123e4567-e89b-12d3-a456-426614174005")
STEP_ID = UUID("123e4567-e89b-12d3-a456-426614174006")
COMPONENT_ID = UUID("123e4567-e89b-12d3-a456-426614174007")
DATASET_ID = UUID("123e4567-e89b-12d3-a456-426614174008")
NOW = datetime(2026, 8, 13, 12, 0, tzinfo=UTC)


def _job(job_id: UUID = JOB_ID, *, state: str = "running") -> Job:
    """Build a worker Job contract for cancellation behavior tests."""
    payload: dict[str, object] = {
        "contractVersion": "v1",
        "id": job_id,
        "pipelineId": PIPELINE_ID,
        "runId": RUN_ID,
        "stepId": STEP_ID,
        "componentId": COMPONENT_ID,
        "state": state,
        "attempt": 1,
        "retryPolicy": {"maxAttempts": 3, "retryDelaySeconds": 30},
        "availableAt": NOW,
    }
    if state == "running":
        payload["claim"] = {"workerId": WORKER_ID, "claimedAt": NOW, "heartbeatAt": NOW}
    return Job.model_validate(payload)


class FakeQueue:
    """Record cooperative cancellation calls without requiring a PostgreSQL server."""

    def __init__(
        self,
        *,
        requested: bool,
        cancelled_job: Job | None = None,
        run_is_terminal: bool = True,
    ) -> None:
        """Configure whether cancellation exists and whether the worker still owns the job."""
        self.requested = requested
        self.cancelled_job = cancelled_job
        self.run_is_terminal = run_is_terminal
        self.calls: list[str] = []

    def cancellation_requested(self, job_id: UUID, worker_id: UUID) -> bool:
        """Return the scripted cancellation state for this active worker job."""
        assert job_id == JOB_ID
        assert worker_id == WORKER_ID
        self.calls.append("poll")
        return self.requested

    def cancel_if_requested(
        self, job_id: UUID, worker_id: UUID, *, now: datetime | None = None
    ) -> Job | None:
        """Return the scripted terminal transition result."""
        assert job_id == JOB_ID
        assert worker_id == WORKER_ID
        assert now == NOW
        self.calls.append("cancel")
        return self.cancelled_job

    def cancel_pending_for_run(self, run_id: UUID, *, now: datetime | None = None) -> list[Job]:
        """Return one queued sibling to demonstrate pending work is stopped."""
        assert run_id == RUN_ID
        assert now == NOW
        self.calls.append("cancel_pending")
        return [_job(PENDING_JOB_ID, state="cancelled")]

    def finalize_cancelled_run(self, run_id: UUID, *, now: datetime | None = None) -> bool:
        """Return whether every active job has completed cancellation."""
        assert run_id == RUN_ID
        assert now == NOW
        self.calls.append("finalize")
        return self.run_is_terminal


class FakeCleanup(DatasetCleanupEligibility):
    """Record Dataset cleanup eligibility without touching storage or PostgreSQL."""

    def __init__(self) -> None:
        """Initialize the call capture."""
        self.calls: list[tuple[UUID, datetime]] = []

    def mark_run_cleanup_eligible(self, run_id: UUID, *, now: datetime | None = None) -> list[UUID]:
        """Return the temporary Dataset marked for garbage collection."""
        assert now is not None
        self.calls.append((run_id, now))
        return [DATASET_ID]


class CleanupCursor:
    """Capture the database statement used to mark Dataset cleanup eligibility."""

    def __init__(self, connection: "CleanupConnection") -> None:
        """Bind the cursor to one scripted database connection."""
        self._connection = connection

    def __enter__(self) -> "CleanupCursor":
        """Open the cursor context."""
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Close the cursor context."""

    def execute(self, query: str, parameters: dict[str, object]) -> None:
        """Capture the short update statement and its parameters."""
        self._connection.query = query
        self._connection.parameters = parameters

    def fetchall(self) -> list[dict[str, object]]:
        """Return the persisted Dataset IDs made cleanup-eligible."""
        return [{"id": DATASET_ID}]


class CleanupConnection:
    """Connection double for one cleanup eligibility transaction."""

    def __init__(self) -> None:
        """Initialize captured query state."""
        self.query = ""
        self.parameters: dict[str, object] = {}
        self.closed = False

    def __enter__(self) -> "CleanupConnection":
        """Open the transaction context."""
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Record that the short transaction has ended."""
        self.closed = True

    def cursor(self, *, row_factory: object) -> CleanupCursor:
        """Return the cleanup query capture cursor."""
        assert row_factory is not None
        return CleanupCursor(self)


def test_poll_does_not_interrupt_work_without_a_cancellation_request() -> None:
    """Allow normal execution to continue while no cancellation has been requested."""
    queue = FakeQueue(requested=False)
    cleanup = FakeCleanup()

    CooperativeCancellation(queue, cleanup).raise_if_requested(_job(), WORKER_ID, now=NOW)

    assert queue.calls == ["poll"]
    assert cleanup.calls == []


def test_cancellation_stops_current_and_pending_work_and_marks_datasets() -> None:
    """Raise a cancellation signal only after terminal cleanup eligibility is persisted."""
    queue = FakeQueue(requested=True, cancelled_job=_job(state="cancelled"))
    cleanup = FakeCleanup()

    with pytest.raises(CancellationRequested, match="1 queued jobs were stopped"):
        CooperativeCancellation(queue, cleanup).raise_if_requested(_job(), WORKER_ID, now=NOW)

    assert queue.calls == ["poll", "cancel", "cancel_pending", "finalize"]
    assert cleanup.calls == [(RUN_ID, NOW)]


def test_lost_claim_stops_execution_without_attempting_cleanup() -> None:
    """Do not let a worker continue after cancellation races with ownership loss."""
    queue = FakeQueue(requested=True, cancelled_job=None)
    cleanup = FakeCleanup()

    with pytest.raises(JobClaimLost, match="no longer owns"):
        CooperativeCancellation(queue, cleanup).raise_if_requested(_job(), WORKER_ID, now=NOW)

    assert queue.calls == ["poll", "cancel"]
    assert cleanup.calls == []


def test_cancellation_defers_dataset_cleanup_until_all_active_jobs_stop() -> None:
    """Keep temporary data available while another branch is still cooperatively stopping."""
    queue = FakeQueue(requested=True, cancelled_job=_job(state="cancelled"), run_is_terminal=False)
    cleanup = FakeCleanup()

    with pytest.raises(CancellationRequested):
        CooperativeCancellation(queue, cleanup).raise_if_requested(_job(), WORKER_ID, now=NOW)

    assert queue.calls == ["poll", "cancel", "cancel_pending", "finalize"]
    assert cleanup.calls == []


def test_postgres_cleanup_marks_all_run_datasets_eligible_in_one_short_transaction() -> None:
    """Persist expiry signaling for the garbage collector without deleting data inline."""
    connection = CleanupConnection()
    cleanup = PostgresDatasetCleanupEligibility(
        "postgresql://worker:password@localhost:5432/pantaetl",
        connection_factory=cast(ConnectionFactory, lambda _database_url: connection),
    )

    marked_ids = cleanup.mark_run_cleanup_eligible(RUN_ID, now=NOW)

    assert marked_ids == [DATASET_ID]
    assert "SET expires_at = COALESCE(expires_at, %(now)s)" in connection.query
    assert connection.parameters == {"run_id": RUN_ID, "now": NOW}
    assert connection.closed is True
