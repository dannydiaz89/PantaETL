"""Payload-free PostgreSQL persistence for worker operational events."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal, cast
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from .job_queue import ConnectionFactory, JobQueueConnection, validate_database_url

OperationalEventKind = Literal[
    "run_queued",
    "run_started",
    "run_succeeded",
    "run_completed_with_warnings",
    "run_failed",
    "run_cancelled",
    "step_queued",
    "step_started",
    "step_succeeded",
    "step_completed_with_warnings",
    "step_failed",
    "step_cancelled",
    "job_claimed",
    "job_retried",
]


@dataclass(frozen=True, slots=True)
class OperationalMetrics:
    """Aggregate counters that never contain source records or record fragments."""

    bytes_read: int | None = None
    bytes_written: int | None = None
    duration_ms: int | None = None
    records_read: int | None = None
    records_written: int | None = None
    retry_attempt: int | None = None


@dataclass(frozen=True, slots=True)
class OperationalEvent:
    """One immutable run or step event correlated only with execution identifiers."""

    event: OperationalEventKind
    pipeline_id: UUID
    run_id: UUID
    metrics: OperationalMetrics = OperationalMetrics()
    job_id: UUID | None = None
    occurred_at: datetime | None = None
    run_step_id: UUID | None = None
    worker_id: UUID | None = None


_INSERT_OPERATIONAL_EVENT = """
INSERT INTO operational_events (
  pipeline_id,
  run_id,
  run_step_id,
  job_id,
  worker_id,
  event,
  records_read,
  records_written,
  bytes_read,
  bytes_written,
  duration_ms,
  retry_attempt,
  occurred_at
) VALUES (
  %(pipeline_id)s,
  %(run_id)s,
  %(run_step_id)s,
  %(job_id)s,
  %(worker_id)s,
  %(event)s,
  %(records_read)s,
  %(records_written)s,
  %(bytes_read)s,
  %(bytes_written)s,
  %(duration_ms)s,
  %(retry_attempt)s,
  %(occurred_at)s
)
"""


class PostgresOperationalEventStore:
    """Write bounded operational metadata in independent, short PostgreSQL transactions."""

    def __init__(
        self,
        database_url: str,
        *,
        connection_factory: ConnectionFactory | None = None,
    ) -> None:
        """Configure event persistence without opening a connection."""
        self._database_url = validate_database_url(database_url)
        self._connection_factory = connection_factory or _connect

    def record(self, event: OperationalEvent) -> None:
        """Persist one validated event without accepting an arbitrary payload."""
        timestamp = _event_time(event.occurred_at)
        metrics = _validate_metrics(event.metrics)
        with self._connection_factory(self._database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    _INSERT_OPERATIONAL_EVENT,
                    {
                        "pipeline_id": event.pipeline_id,
                        "run_id": event.run_id,
                        "run_step_id": event.run_step_id,
                        "job_id": event.job_id,
                        "worker_id": event.worker_id,
                        "event": event.event,
                        "records_read": metrics.records_read,
                        "records_written": metrics.records_written,
                        "bytes_read": metrics.bytes_read,
                        "bytes_written": metrics.bytes_written,
                        "duration_ms": metrics.duration_ms,
                        "retry_attempt": metrics.retry_attempt,
                        "occurred_at": timestamp,
                    },
                )


def _connect(database_url: str) -> JobQueueConnection:
    """Open one PostgreSQL connection for a bounded event insert."""
    return cast(JobQueueConnection, psycopg.connect(database_url))


def _event_time(value: datetime | None) -> datetime:
    """Return a UTC event timestamp and reject ambiguous wall-clock values."""
    timestamp = value or datetime.now(UTC)
    if timestamp.tzinfo is None:
        raise ValueError("Operational event timestamps must include a timezone.")
    return timestamp


def _validate_metrics(metrics: OperationalMetrics) -> OperationalMetrics:
    """Ensure every persisted aggregate fits PostgreSQL's signed integer range."""
    for name, value in (
        ("bytes_read", metrics.bytes_read),
        ("bytes_written", metrics.bytes_written),
        ("duration_ms", metrics.duration_ms),
        ("records_read", metrics.records_read),
        ("records_written", metrics.records_written),
        ("retry_attempt", metrics.retry_attempt),
    ):
        if value is not None and (isinstance(value, bool) or not 0 <= value <= 2_147_483_647):
            raise ValueError(f"{name} must be a non-negative PostgreSQL integer.")
    return metrics
