"""Tests for transactional and idempotent PostgreSQL Export delivery."""

from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

import polars as pl
import pytest

from workers.python.components.exports.postgres_export import (
    POSTGRES_EXPORT_METADATA,
    PostgresExport,
    PostgresExportError,
)
from workers.python.generated.artifact_descriptor import ArtifactDescriptor
from workers.python.generated.dataset_descriptor import DatasetDescriptor, Family, Kind, Storage
from workers.python.registries import ExportExecutor, ExportRegistry

PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")
STEP_ID = UUID("00000000-0000-0000-0000-000000000003")


class StubDatasetStorage:
    """Small tabular storage boundary that avoids filesystem setup in SQL transaction tests."""

    def read_tabular(self, _descriptor: DatasetDescriptor) -> pl.DataFrame:
        """Return representative destination rows without exposing real record storage."""
        return pl.DataFrame({"order_id": [1, 2], "total": [12.5, 9.0]})


class RegisteredExport:
    """No-op executor used to exercise metadata-only registry validation."""

    def __call__(
        self, _dataset: DatasetDescriptor, _configuration: Mapping[str, object]
    ) -> ArtifactDescriptor | None:
        """Return no artifact because this dummy is never executed by the registry test."""
        return None


class RecordingCursor:
    """Cursor double that records static SQL and parameterized staging rows."""

    def __init__(self, *, fail_on: str | None = None) -> None:
        """Create a cursor that can fail one named SQL phase."""
        self.statements: list[str] = []
        self.rows: list[tuple[object, ...]] = []
        self._fail_on = fail_on

    def __enter__(self) -> "RecordingCursor":
        """Open the fake cursor."""
        return self

    def __exit__(self, *_arguments: object) -> None:
        """Close the fake cursor."""

    def execute(self, query: str) -> None:
        """Record static SQL and optionally simulate a destination failure."""
        self.statements.append(query)
        if self._fail_on is not None and self._fail_on in query:
            raise RuntimeError("destination unavailable")

    def executemany(self, _query: str, parameters: Iterable[tuple[object, ...]]) -> None:
        """Consume parameterized rows as a driver would during staging."""
        self.rows.extend(parameters)


class RecordingConnection:
    """Transaction double that records whether an Export would commit or roll back."""

    def __init__(self, cursor: RecordingCursor) -> None:
        """Create a connection around the supplied cursor behavior."""
        self.cursor_value = cursor
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> "RecordingConnection":
        """Open the fake transaction."""
        return self

    def __exit__(self, exc_type: object, *_arguments: object) -> None:
        """Mirror PostgreSQL context semantics for the Export transaction."""
        self.committed = exc_type is None
        self.rolled_back = exc_type is not None

    def cursor(self) -> RecordingCursor:
        """Return the one transaction cursor."""
        return self.cursor_value


def _dataset() -> DatasetDescriptor:
    return DatasetDescriptor(
        contractVersion="v1",
        id=UUID("00000000-0000-0000-0000-000000000004"),
        family=Family.tabular,
        format="parquet",
        storage=Storage(kind=Kind.local, location="runs/example/dataset.parquet", encrypted=False),
        pipelineId=PIPELINE_ID,
        runId=RUN_ID,
        stepId=STEP_ID,
        createdAt=datetime(2026, 8, 13, tzinfo=UTC),
        expiresAt=datetime(2026, 8, 14, tzinfo=UTC),
    )


def test_postgres_replace_stages_then_replaces_inside_one_transaction() -> None:
    """A failed replace cannot leave a target containing only a partial Dataset."""
    cursor = RecordingCursor()
    connection = RecordingConnection(cursor)
    export = PostgresExport(
        StubDatasetStorage(),
        "postgresql://user:secret@localhost:5432/destination",
        connection_factory=lambda _url: connection,
    )

    export(_dataset(), {"targetTable": "reporting.orders", "writeMode": "replace"})

    assert connection.committed
    assert not connection.rolled_back
    assert cursor.rows == [(1, 12.5), (2, 9.0)]
    assert "CREATE TEMPORARY TABLE" in cursor.statements[0]
    assert cursor.statements[1] == 'TRUNCATE TABLE "reporting"."orders"'
    assert 'INSERT INTO "reporting"."orders"' in cursor.statements[2]


def test_postgres_append_requires_database_uniqueness_for_idempotent_retry() -> None:
    """Append delegates duplicate suppression to destination uniqueness constraints."""
    cursor = RecordingCursor()
    connection = RecordingConnection(cursor)
    export = PostgresExport(
        StubDatasetStorage(),
        "postgresql://user:secret@localhost:5432/destination",
        connection_factory=lambda _url: connection,
    )

    export(_dataset(), {"targetTable": "orders", "writeMode": "append"})

    assert connection.committed
    assert cursor.statements[-1].endswith("ON CONFLICT DO NOTHING")


def test_postgres_export_rolls_back_and_uses_safe_error_when_delivery_fails() -> None:
    """Destination errors expose retry context without connection or record contents."""
    cursor = RecordingCursor(fail_on="TRUNCATE")
    connection = RecordingConnection(cursor)
    export = PostgresExport(
        StubDatasetStorage(),
        "postgresql://user:secret@localhost:5432/destination",
        connection_factory=lambda _url: connection,
    )

    with pytest.raises(PostgresExportError, match="transaction was rolled back") as error:
        export(_dataset(), {"targetTable": "orders"})

    assert connection.rolled_back
    assert "secret" not in str(error.value)
    assert "12.5" not in str(error.value)


def test_postgres_export_rejects_sql_fragments_and_keeps_connection_secret_bound() -> None:
    """Portable config permits safe relation names but rejects inline secret values."""
    registry = ExportRegistry()
    registry.register(POSTGRES_EXPORT_METADATA, cast(ExportExecutor, RegisteredExport()))

    registry.validate_configuration("export.postgres", "v1", {"targetTable": "orders"})
    with pytest.raises(Exception, match="secret binding"):
        registry.validate_configuration(
            "export.postgres",
            "v1",
            {"targetTable": "orders", "connectionUrl": "postgresql://inline-secret"},
        )

    export = PostgresExport(StubDatasetStorage(), "postgresql://user:secret@localhost/destination")
    with pytest.raises(PostgresExportError, match="identifiers"):
        export(_dataset(), {"targetTable": "orders; DROP TABLE users"})
