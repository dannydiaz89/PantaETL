"""Tests for payload-free operational event persistence."""

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

import pytest

from workers.python.job_queue import ConnectionFactory
from workers.python.observability import (
    OperationalEvent,
    OperationalMetrics,
    PostgresOperationalEventStore,
)

DATABASE_URL = "postgresql://worker:password@localhost:5432/pantaetl"
PIPELINE_ID = UUID("123e4567-e89b-12d3-a456-426614174001")
RUN_ID = UUID("123e4567-e89b-12d3-a456-426614174002")
STEP_ID = UUID("123e4567-e89b-12d3-a456-426614174003")
NOW = datetime(2026, 8, 13, 12, 0, tzinfo=UTC)


class FakeCursor:
    """Capture a parameterized operational event insert."""

    def __init__(self, owner: "FakeConnection") -> None:
        self._owner = owner

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        return None

    def execute(self, query: str, parameters: Mapping[str, object]) -> None:
        self._owner.query = query
        self._owner.parameters = parameters


class FakeConnection:
    """Minimal connection double for one short event insert."""

    def __init__(self) -> None:
        self.parameters: Mapping[str, object] = {}
        self.query = ""

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        return None

    def cursor(self, *, row_factory: object) -> FakeCursor:
        assert row_factory is not None
        return FakeCursor(self)


def test_operational_events_store_only_correlations_and_aggregate_metrics() -> None:
    """Persist lifecycle counters without a payload or free-form context parameter."""
    connection = FakeConnection()
    store = PostgresOperationalEventStore(
        DATABASE_URL,
        connection_factory=cast(ConnectionFactory, lambda _url: connection),
    )

    store.record(
        OperationalEvent(
            event="step_succeeded",
            pipeline_id=PIPELINE_ID,
            run_id=RUN_ID,
            run_step_id=STEP_ID,
            occurred_at=NOW,
            metrics=OperationalMetrics(records_read=8, records_written=8, duration_ms=42),
        )
    )

    assert "operational_events" in connection.query
    assert "payload" not in connection.query
    assert "context" not in connection.query
    assert connection.parameters["records_read"] == 8
    assert connection.parameters["duration_ms"] == 42


@pytest.mark.parametrize(
    "metrics", [OperationalMetrics(records_read=-1), OperationalMetrics(bytes_read=True)]
)
def test_operational_events_reject_unsafe_metrics(metrics: OperationalMetrics) -> None:
    """Fail before an invalid counter can be sent to PostgreSQL."""
    store = PostgresOperationalEventStore(
        DATABASE_URL,
        connection_factory=cast(ConnectionFactory, lambda _url: FakeConnection()),
    )

    with pytest.raises(ValueError, match="non-negative"):
        store.record(
            OperationalEvent(
                event="run_started",
                pipeline_id=PIPELINE_ID,
                run_id=RUN_ID,
                occurred_at=NOW,
                metrics=metrics,
            )
        )
