"""PostgreSQL Export implementation with transactional retry-safe write modes."""

import re
from collections.abc import Callable, Iterable
from typing import Protocol, cast
from uuid import UUID

import polars as pl
import psycopg

from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...job_queue import validate_database_url
from ...registries import ComponentConfiguration, ExportRegistry

POSTGRES_EXPORT_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "export",
        "type": "export.postgres",
        "version": "v1",
        "displayNameKey": "components.exports.postgres.name",
        "descriptionKey": "components.exports.postgres.description",
        "configFields": [
            {
                "key": "targetTable",
                "type": "text",
                "labelKey": "components.exports.postgres.targetTable",
                "descriptionKey": "components.exports.postgres.targetTableDescription",
                "placeholderKey": "components.exports.postgres.targetTableExample",
                "required": True,
                "secret": False,
            },
            {
                "key": "writeMode",
                "type": "select",
                "labelKey": "components.exports.postgres.writeMode",
                "descriptionKey": "components.exports.postgres.writeModeDescription",
                "required": False,
                "secret": False,
                "options": [
                    {
                        "value": "replace",
                        "labelKey": "components.exports.postgres.writeMode.replace",
                    },
                    {
                        "value": "append",
                        "labelKey": "components.exports.postgres.writeMode.append",
                    },
                ],
            },
            {
                "key": "connectionUrl",
                "type": "text",
                "labelKey": "components.exports.postgres.connectionUrl",
                "required": True,
                "secret": True,
            },
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": [],
    }
)

_IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]{0,62}")


class PostgresExportError(RuntimeError):
    """Raised when a PostgreSQL Export cannot complete with retry-safe semantics."""


class TabularDatasetReader(Protocol):
    """Dataset boundary needed by PostgreSQL Export before rows are staged."""

    def read_tabular(self, descriptor: DatasetDescriptor) -> pl.DataFrame:
        """Load one tabular Dataset for a destination that consumes rows directly."""


class PostgresExportCursor(Protocol):
    """Minimal transactional cursor boundary required by the PostgreSQL Export."""

    def __enter__(self) -> "PostgresExportCursor":
        """Open the cursor context."""

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Close the cursor context."""

    def execute(self, query: str) -> None:
        """Execute a static, internally constructed SQL statement."""

    def executemany(self, query: str, parameters: Iterable[tuple[object, ...]]) -> None:
        """Insert a bounded iterable of parameterized tabular rows."""


class PostgresExportConnection(Protocol):
    """Connection boundary whose context commits or rolls back one complete Export."""

    def __enter__(self) -> "PostgresExportConnection":
        """Open the transaction context."""

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Commit on success or roll back on any Export failure."""

    def cursor(self) -> PostgresExportCursor:
        """Open a cursor for the transaction's staging and delivery statements."""


PostgresConnectionFactory = Callable[[str], PostgresExportConnection]


class PostgresExport:
    """Deliver tabular data to PostgreSQL through a single retry-safe transaction."""

    def __init__(
        self,
        datasets: TabularDatasetReader,
        database_url: str,
        *,
        connection_factory: PostgresConnectionFactory | None = None,
    ) -> None:
        """Bind a secret-resolved PostgreSQL connection and temporary Dataset storage."""
        self._datasets = datasets
        self._database_url = validate_database_url(database_url)
        self._connection_factory = connection_factory or _connect

    def __call__(self, dataset: DatasetDescriptor, configuration: ComponentConfiguration) -> None:
        """Atomically replace or idempotently append tabular records to PostgreSQL.

        Replace writes through a temporary table, then truncates and reloads the target
        within one transaction. Append requires the target's unique constraints and
        uses `ON CONFLICT DO NOTHING`, so a retry of the same Dataset cannot duplicate
        rows. Neither mode commits partial target output.
        """
        target_table = _quote_relation(_required_text(configuration, "targetTable"))
        write_mode = _write_mode(configuration)
        try:
            frame = self._datasets.read_tabular(dataset)
        except Exception as error:
            raise PostgresExportError(
                "PostgreSQL export input is not an available tabular Dataset."
            ) from error
        if not frame.columns:
            raise PostgresExportError("PostgreSQL export requires at least one column.")

        try:
            self._write(frame, target_table, write_mode, dataset.runId)
        except PostgresExportError:
            raise
        except Exception as error:
            raise PostgresExportError(
                "PostgreSQL export did not complete; the destination transaction was rolled back."
            ) from error
        return None

    def _write(self, frame: pl.DataFrame, target_table: str, write_mode: str, run_id: UUID) -> None:
        """Stage rows and deliver them inside one transaction before it can commit."""
        staging_table = _quote_identifier(f"pantaetl_export_{run_id.hex}")
        columns = ", ".join(_quote_identifier(column) for column in frame.columns)
        placeholders = ", ".join("%s" for _ in frame.columns)
        insert_stage = f"INSERT INTO {staging_table} ({columns}) VALUES ({placeholders})"

        with self._connection_factory(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"CREATE TEMPORARY TABLE {staging_table} "
                    f"(LIKE {target_table} INCLUDING DEFAULTS) ON COMMIT DROP"
                )
                cursor.executemany(
                    insert_stage, cast(Iterable[tuple[object, ...]], frame.iter_rows())
                )
                if write_mode == "replace":
                    cursor.execute(f"TRUNCATE TABLE {target_table}")
                    cursor.execute(
                        f"INSERT INTO {target_table} ({columns}) SELECT {columns} FROM {staging_table}"
                    )
                else:
                    cursor.execute(
                        f"INSERT INTO {target_table} ({columns}) SELECT {columns} FROM {staging_table} "
                        "ON CONFLICT DO NOTHING"
                    )


def register_postgres_export(registry: ExportRegistry, export: PostgresExport) -> None:
    """Install the PostgreSQL Export without coupling it to other Export modules."""
    registry.register(POSTGRES_EXPORT_METADATA, export)


def _connect(database_url: str) -> PostgresExportConnection:
    """Open one PostgreSQL connection whose context owns the complete output transaction."""
    return cast(PostgresExportConnection, psycopg.connect(database_url))


def _required_text(configuration: ComponentConfiguration, key: str) -> str:
    """Read one required portable text configuration without exposing secret bindings."""
    value = configuration.get(key)
    if not isinstance(value, str) or not value:
        raise PostgresExportError(f"PostgreSQL export requires {key} configuration.")
    return value


def _write_mode(configuration: ComponentConfiguration) -> str:
    """Read the explicitly supported write mode, defaulting to atomic replacement."""
    value = configuration.get("writeMode", "replace")
    if value not in {"replace", "append"}:
        raise PostgresExportError("PostgreSQL export writeMode must be replace or append.")
    return value


def _quote_relation(value: str) -> str:
    """Quote a safe schema-qualified target relation without accepting SQL fragments."""
    parts = value.split(".")
    if not 1 <= len(parts) <= 2:
        raise PostgresExportError("PostgreSQL targetTable must be a table or schema.table name.")
    return ".".join(_quote_identifier(part) for part in parts)


def _quote_identifier(value: str) -> str:
    """Quote a validated PostgreSQL identifier before composing internal SQL."""
    if _IDENTIFIER.fullmatch(value) is None:
        raise PostgresExportError(
            "PostgreSQL identifiers must use letters, digits, and underscores."
        )
    return f'"{value}"'
