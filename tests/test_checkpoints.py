"""Tests for Source checkpoint candidates and successful-run persistence guards."""

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

import pytest

from workers.python.checkpoints import (
    CheckpointCandidate,
    CheckpointStore,
    CheckpointValue,
    CheckpointValueError,
    PostgresCheckpointStore,
    SourceCheckpointLifecycle,
)
from workers.python.job_queue import ConnectionFactory

DATABASE_URL = "postgresql://worker:password@localhost:5432/pantaetl"
PIPELINE_ID = UUID("123e4567-e89b-12d3-a456-426614174001")
SOURCE_ID = UUID("123e4567-e89b-12d3-a456-426614174002")
RUN_ID = UUID("123e4567-e89b-12d3-a456-426614174003")
NOW = datetime(2026, 8, 13, 12, 0, tzinfo=UTC)


class FakeCheckpointStore(CheckpointStore):
    """Capture source lifecycle calls without a PostgreSQL server."""

    def __init__(self, current: CheckpointValue | None, commit_result: bool) -> None:
        """Set the current durable value and successful-run commit outcome."""
        self.current = current
        self.commit_result = commit_result
        self.commits: list[tuple[CheckpointCandidate, UUID, datetime | None]] = []

    def load(self, pipeline_id: UUID, source_component_id: UUID) -> CheckpointValue | None:
        """Return the stored current checkpoint after checking its Source ownership."""
        assert (pipeline_id, source_component_id) == (PIPELINE_ID, SOURCE_ID)
        return self.current

    def commit_if_run_succeeded(
        self, candidate: CheckpointCandidate, run_id: UUID, *, now: datetime | None = None
    ) -> bool:
        """Record the candidate that would be persisted after the successful run."""
        self.commits.append((candidate, run_id, now))
        return self.commit_result


class CheckpointCursor:
    """Cursor double returning scripted load, lock, and upsert rows."""

    def __init__(self, connection: "CheckpointConnection") -> None:
        """Bind this cursor to a one-transaction scripted connection."""
        self._connection = connection

    def __enter__(self) -> "CheckpointCursor":
        """Record cursor opening."""
        self._connection.events.append("cursor_opened")
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Record cursor closing."""
        self._connection.events.append("cursor_closed")

    def execute(self, query: str, parameters: Mapping[str, object]) -> None:
        """Capture each short checkpoint transaction statement."""
        self._connection.queries.append((query, parameters))

    def fetchone(self) -> Mapping[str, object] | None:
        """Return the next scripted row for a load, lock, or upsert operation."""
        return self._connection.rows.pop(0)

    def fetchall(self) -> list[Mapping[str, object]]:
        """Provide the queue protocol's unused multi-row operation."""
        return []


class CheckpointConnection:
    """One scripted transaction with explicit close ordering assertions."""

    def __init__(self, rows: list[Mapping[str, object] | None]) -> None:
        """Set rows returned by ordered cursor fetches."""
        self.rows = rows
        self.events: list[str] = []
        self.queries: list[tuple[str, Mapping[str, object]]] = []

    def __enter__(self) -> "CheckpointConnection":
        """Record opening the short checkpoint transaction."""
        self.events.append("transaction_opened")
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Record commit/rollback and connection close."""
        self.events.append("transaction_closed")

    def cursor(self, *, row_factory: object) -> CheckpointCursor:
        """Return the scripted cursor while requiring a dictionary row factory."""
        assert row_factory is not None
        return CheckpointCursor(self)


def test_source_lifecycle_loads_current_checkpoint_and_holds_candidate_until_success() -> None:
    """A Source can prepare a next value without changing its durable checkpoint early."""
    store = FakeCheckpointStore(current={"page": "previous"}, commit_result=True)
    lifecycle = SourceCheckpointLifecycle(store, PIPELINE_ID, SOURCE_ID)

    assert lifecycle.load() == {"page": "previous"}
    candidate = lifecycle.propose({"page": "next", "seen": 42})
    assert store.commits == []

    assert lifecycle.commit_after_run_success(RUN_ID, now=NOW) is True
    assert store.commits == [(candidate, RUN_ID, NOW)]


def test_failed_or_cancelled_pipeline_discards_candidate_without_advancing_checkpoint() -> None:
    """Failure handling can discard a Source candidate before any durable write occurs."""
    store = FakeCheckpointStore(current={"page": "previous"}, commit_result=True)
    lifecycle = SourceCheckpointLifecycle(store, PIPELINE_ID, SOURCE_ID)
    lifecycle.propose({"page": "uncommitted"})

    lifecycle.discard()

    assert lifecycle.commit_after_run_success(RUN_ID, now=NOW) is False
    assert store.commits == []


def test_postgres_store_rejects_non_successful_runs_before_upserting_checkpoint() -> None:
    """The database run-state guard makes an attempted failure commit a no-op."""
    connection = CheckpointConnection([{"id": PIPELINE_ID}, None])
    store = PostgresCheckpointStore(
        DATABASE_URL,
        connection_factory=cast(ConnectionFactory, lambda _database_url: connection),
    )
    candidate = CheckpointCandidate(PIPELINE_ID, SOURCE_ID, {"page": "candidate"})

    assert store.commit_if_run_succeeded(candidate, RUN_ID, now=NOW) is False
    assert connection.events == [
        "transaction_opened",
        "cursor_opened",
        "cursor_closed",
        "transaction_closed",
    ]
    lock_query = connection.queries[0][0]
    commit_query, commit_parameters = connection.queries[1]
    assert "FOR UPDATE" in lock_query
    assert "state IN ('succeeded', 'completed_with_warnings')" in commit_query
    assert commit_parameters["run_id"] == RUN_ID


def test_postgres_store_serializes_same_pipeline_commit_before_upsert() -> None:
    """Lock the pipeline row so concurrent Source commits cannot update it simultaneously."""
    connection = CheckpointConnection([{"id": PIPELINE_ID}, {"pipeline_id": PIPELINE_ID}])
    store = PostgresCheckpointStore(
        DATABASE_URL,
        connection_factory=cast(ConnectionFactory, lambda _database_url: connection),
    )
    candidate = CheckpointCandidate(PIPELINE_ID, SOURCE_ID, {"cursor": "next"})

    assert store.commit_if_run_succeeded(candidate, RUN_ID, now=NOW) is True
    assert len(connection.queries) == 2
    assert "FROM pipelines" in connection.queries[0][0]
    assert "ON CONFLICT (pipeline_id, source_component_id)" in connection.queries[1][0]


def test_checkpoint_store_loads_json_and_rejects_non_json_source_candidates() -> None:
    """Preserve JSON-only cross-process checkpoint values without storing opaque objects."""
    connection = CheckpointConnection([{"checkpoint": {"lastId": "42"}}])
    store = PostgresCheckpointStore(
        DATABASE_URL,
        connection_factory=cast(ConnectionFactory, lambda _database_url: connection),
    )

    assert store.load(PIPELINE_ID, SOURCE_ID) == {"lastId": "42"}
    with pytest.raises(CheckpointValueError, match="JSON-compatible"):
        SourceCheckpointLifecycle(FakeCheckpointStore(None, True), PIPELINE_ID, SOURCE_ID).propose(
            {"invalid": object()}
        )
