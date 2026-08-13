"""Tests for read-only PostgreSQL Source streaming and checkpoint candidates."""

from collections.abc import Mapping
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import cast
from uuid import UUID

import pytest

from workers.python.checkpoints import (
    CheckpointCandidate,
    CheckpointStore,
    CheckpointValue,
    SourceCheckpointLifecycle,
)
from workers.python.components.sources.postgres_source import (
    PostgresSource,
    PostgresSourceConnection,
    PostgresSourceError,
)
from workers.python.generated.source_execution_request import SourceExecutionRequest
from workers.python.storage import LocalDatasetStorage

DATABASE_URL = "postgresql://reader:secret@localhost:5432/source"
PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")
SOURCE_ID = UUID("00000000-0000-0000-0000-000000000005")


class FakeCheckpointStore(CheckpointStore):
    """Capture deferred checkpoint candidates without a PostgreSQL control-plane database."""

    def __init__(self, current: CheckpointValue | None) -> None:
        """Set the checkpoint loaded before the source query starts."""
        self.current = current
        self.candidates: list[CheckpointCandidate] = []

    def load(self, pipeline_id: UUID, source_component_id: UUID) -> CheckpointValue | None:
        """Return the expected source checkpoint for this pipeline component."""
        assert (pipeline_id, source_component_id) == (PIPELINE_ID, SOURCE_ID)
        return self.current

    def commit_if_run_succeeded(
        self, candidate: CheckpointCandidate, run_id: UUID, *, now: datetime | None = None
    ) -> bool:
        """Capture candidates only when the test simulates successful run completion."""
        assert run_id == RUN_ID
        self.candidates.append(candidate)
        return True


class FakeCursor:
    """Expose either setup execution or bounded server-side fetches."""

    def __init__(self, rows: list[list[Mapping[str, object]]]) -> None:
        """Set the batches this cursor returns in order."""
        self.rows = rows
        self.queries: list[tuple[str, Mapping[str, object] | None]] = []
        self.fetch_sizes: list[int] = []

    def __enter__(self) -> "FakeCursor":
        """Open the deterministic cursor context."""
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Close the deterministic cursor context."""

    def execute(self, query: str, parameters: Mapping[str, object] | None = None) -> None:
        """Capture static setup or parameterized source SQL."""
        self.queries.append((query, parameters))

    def fetchmany(self, size: int) -> list[Mapping[str, object]]:
        """Return one preconfigured batch, requiring the configured chunk size."""
        self.fetch_sizes.append(size)
        return self.rows.pop(0) if self.rows else []


class FakeConnection:
    """Provide a setup cursor and a distinct server-side source cursor."""

    def __init__(self, batches: list[list[Mapping[str, object]]]) -> None:
        """Set rows returned from the server-side source cursor."""
        self.setup_cursor = FakeCursor([])
        self.source_cursor = FakeCursor(batches)
        self.source_cursor_names: list[str | None] = []

    def __enter__(self) -> "FakeConnection":
        """Open the read transaction."""
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Close the read transaction."""

    def cursor(self, *, name: str | None = None, row_factory: object | None = None) -> FakeCursor:
        """Select setup or named streaming cursor while requiring mapping rows."""
        assert row_factory is not None
        if name is None:
            return self.setup_cursor
        self.source_cursor_names.append(name)
        return self.source_cursor


def source_request(values: dict[str, object]) -> SourceExecutionRequest:
    """Build a valid PostgreSQL Source request with portable query settings."""
    return SourceExecutionRequest.model_validate(
        {
            "contractVersion": "v1",
            "jobId": "00000000-0000-0000-0000-000000000004",
            "pipelineId": str(PIPELINE_ID),
            "runId": str(RUN_ID),
            "stepId": "00000000-0000-0000-0000-000000000003",
            "componentId": str(SOURCE_ID),
            "componentType": "source.postgres",
            "componentVersion": "v1",
            "configuration": {"values": values, "secretBindings": []},
        }
    )


def test_postgres_source_streams_server_side_batches_and_proposes_checkpoint(
    tmp_path: Path,
) -> None:
    """A table Source fetches chunks only and persists one tabular Dataset without all rows in RAM."""
    checkpoint_store = FakeCheckpointStore({"value": 10})
    checkpoint_lifecycle = SourceCheckpointLifecycle(checkpoint_store, PIPELINE_ID, SOURCE_ID)
    connection = FakeConnection(
        [
            [{"id": 11, "total": Decimal("12.50")}, {"id": 12, "total": Decimal("9.00")}],
            [{"id": 13, "total": Decimal("20.00")}],
        ]
    )
    source = PostgresSource(
        LocalDatasetStorage(tmp_path / "datasets"),
        DATABASE_URL,
        checkpoint_lifecycle=checkpoint_lifecycle,
        connection_factory=lambda _url: cast(PostgresSourceConnection, connection),
    )

    descriptor = source(
        source_request({"table": "public.orders", "chunkSize": 2, "checkpointColumn": "id"})
    )

    assert connection.setup_cursor.queries == [("SET TRANSACTION READ ONLY", None)]
    source_query, parameters = connection.source_cursor.queries[0]
    assert (
        source_query
        == 'SELECT * FROM "public"."orders" WHERE "id" > %(checkpoint)s ORDER BY "id" ASC'
    )
    assert parameters == {"checkpoint": 10}
    assert connection.source_cursor_names[0] is not None
    assert connection.source_cursor.fetch_sizes == [2, 2, 2]
    assert LocalDatasetStorage(tmp_path / "datasets").read_tabular(descriptor).to_dicts() == [
        {"id": 11, "total": Decimal("12.50")},
        {"id": 12, "total": Decimal("9.00")},
        {"id": 13, "total": Decimal("20.00")},
    ]

    assert checkpoint_store.candidates == []
    assert checkpoint_lifecycle.commit_after_run_success(RUN_ID) is True
    assert checkpoint_store.candidates[0].value == {"value": 13}


def test_postgres_source_rejects_unsafe_queries_before_connecting(tmp_path: Path) -> None:
    """Only one read-only SELECT may execute; SQL fragments never reach a source connection."""
    source = PostgresSource(LocalDatasetStorage(tmp_path / "datasets"), DATABASE_URL)

    with pytest.raises(PostgresSourceError, match="one SELECT"):
        source(source_request({"query": "DELETE FROM orders"}))
    with pytest.raises(PostgresSourceError, match="exactly one"):
        source(source_request({"table": "orders", "query": "SELECT * FROM orders"}))


def test_postgres_source_uses_no_parameters_when_a_table_has_no_checkpoint(tmp_path: Path) -> None:
    """Fresh table reads do not send unused parameters to PostgreSQL drivers."""
    connection = FakeConnection([])
    source = PostgresSource(
        LocalDatasetStorage(tmp_path / "datasets"),
        DATABASE_URL,
        connection_factory=lambda _url: cast(PostgresSourceConnection, connection),
    )

    source(source_request({"table": "orders"}))

    assert connection.source_cursor.queries == [('SELECT * FROM "orders"', None)]
