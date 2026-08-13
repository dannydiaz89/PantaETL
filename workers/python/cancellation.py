"""Cooperative cancellation and terminal Dataset cleanup eligibility."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol, cast
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from .generated import Job
from .job_queue import ConnectionFactory, JobQueueConnection, validate_database_url


class CancellationRequested(RuntimeError):
    """Signals that an executor must stop work because its run was cancelled."""


class JobClaimLost(RuntimeError):
    """Signals that a worker must stop after it no longer owns an active job."""


class DatasetCleanupEligibility(Protocol):
    """Marks temporary Datasets for collection after their run becomes terminal."""

    def mark_run_cleanup_eligible(self, run_id: UUID, *, now: datetime | None = None) -> list[UUID]:
        """Set expiry for temporary Dataset records still retained by one run."""


class CancellationQueue(Protocol):
    """Queue transitions required to cooperatively stop a cancelled run."""

    def cancellation_requested(self, job_id: UUID, worker_id: UUID) -> bool:
        """Return whether the active job's run requested cancellation."""

    def cancel_if_requested(
        self, job_id: UUID, worker_id: UUID, *, now: datetime | None = None
    ) -> Job | None:
        """Cancel a worker-owned job only when its run requested cancellation."""

    def cancel_pending_for_run(self, run_id: UUID, *, now: datetime | None = None) -> list[Job]:
        """Cancel queued jobs belonging to a cancellation-requested run."""

    def finalize_cancelled_run(self, run_id: UUID, *, now: datetime | None = None) -> bool:
        """Make the run terminal only after all active work has stopped."""


_MARK_RUN_DATASETS_CLEANUP_ELIGIBLE = """
UPDATE datasets
SET expires_at = COALESCE(expires_at, %(now)s)
WHERE run_id = %(run_id)s
RETURNING id
"""


class PostgresDatasetCleanupEligibility:
    """Persist cleanup eligibility so the garbage collector can safely retry removal."""

    def __init__(
        self,
        database_url: str,
        *,
        connection_factory: ConnectionFactory | None = None,
    ) -> None:
        """Configure cleanup eligibility updates without opening a database connection."""
        self._database_url = validate_database_url(database_url)
        self._connection_factory = connection_factory or _connect

    def mark_run_cleanup_eligible(self, run_id: UUID, *, now: datetime | None = None) -> list[UUID]:
        """Set expiry on all temporary Datasets owned by a terminal run."""
        timestamp = _cleanup_time(now)
        with self._connection_factory(self._database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    _MARK_RUN_DATASETS_CLEANUP_ELIGIBLE,
                    {"run_id": run_id, "now": timestamp},
                )
                rows = cursor.fetchall()
        return [cast(UUID, row["id"]) for row in rows]


@dataclass(frozen=True, slots=True)
class CancellationResult:
    """Terminal state changes performed after one cooperative cancellation poll."""

    cancelled_job: Job
    cancelled_pending_jobs: tuple[Job, ...]
    cleanup_eligible_dataset_ids: tuple[UUID, ...]


class CooperativeCancellation:
    """Poll run cancellation and make terminal cleanup signaling explicit to executors."""

    def __init__(self, queue: CancellationQueue, cleanup: DatasetCleanupEligibility) -> None:
        """Bind queue transitions and cleanup eligibility for one worker runtime."""
        self._queue = queue
        self._cleanup = cleanup

    def raise_if_requested(self, job: Job, worker_id: UUID, *, now: datetime | None = None) -> None:
        """Stop execution after atomically recording cancellation and cleanup eligibility.

        Executors call this between bounded units of Source, Transform, or Export
        work. It raises only after the job no longer appears runnable by this worker.
        """
        if not self._queue.cancellation_requested(job.id, worker_id):
            return

        timestamp = _cleanup_time(now)
        cancelled_job = self._queue.cancel_if_requested(job.id, worker_id, now=timestamp)
        if cancelled_job is None:
            raise JobClaimLost(
                "Worker no longer owns the active job after cancellation was requested."
            )

        pending_jobs = self._queue.cancel_pending_for_run(cancelled_job.runId, now=timestamp)
        run_is_terminal = self._queue.finalize_cancelled_run(cancelled_job.runId, now=timestamp)
        dataset_ids = (
            self._cleanup.mark_run_cleanup_eligible(cancelled_job.runId, now=timestamp)
            if run_is_terminal
            else []
        )
        result = CancellationResult(
            cancelled_job=cancelled_job,
            cancelled_pending_jobs=tuple(pending_jobs),
            cleanup_eligible_dataset_ids=tuple(dataset_ids),
        )
        raise CancellationRequested(_cancellation_message(result))


def _connect(database_url: str) -> JobQueueConnection:
    """Open one PostgreSQL connection for a short cleanup eligibility transaction."""
    return cast(JobQueueConnection, psycopg.connect(database_url))


def _cleanup_time(value: datetime | None) -> datetime:
    """Use UTC for cleanup eligibility and reject ambiguous caller-supplied times."""
    timestamp = value or datetime.now(UTC)
    if timestamp.tzinfo is None:
        raise ValueError("Cleanup timestamps must include a timezone.")
    return timestamp


def _cancellation_message(result: CancellationResult) -> str:
    """Create safe cancellation context without exposing Dataset paths or record data."""
    return (
        f"Job {result.cancelled_job.id} was cancelled; "
        f"{len(result.cancelled_pending_jobs)} queued jobs were stopped and "
        f"{len(result.cleanup_eligible_dataset_ids)} temporary datasets are cleanup-eligible."
    )
