"""PostgreSQL Source implementation with read-only streaming extraction."""

import re
from collections.abc import Callable, Iterator, Mapping
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Protocol, cast
from uuid import UUID, uuid4

import polars as pl
import psycopg
from psycopg.rows import dict_row

from ...checkpoints import CheckpointValue, SourceCheckpointLifecycle
from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...generated.source_execution_request import SourceExecutionRequest
from ...job_queue import validate_database_url
from ...registries import SourceRegistry
from ...storage import DatasetLifecycle, DatasetStorage

POSTGRES_SOURCE_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "source",
        "type": "source.postgres",
        "version": "v1",
        "displayNameKey": "components.sources.postgres.name",
        "descriptionKey": "components.sources.postgres.description",
        "configFields": [
            {
                "key": "connectionUrl",
                "type": "text",
                "labelKey": "components.sources.postgres.connectionUrl",
                "required": True,
                "secret": True,
            },
            {
                "key": "table",
                "type": "text",
                "labelKey": "components.sources.postgres.table",
                "required": False,
                "secret": False,
            },
            {
                "key": "query",
                "type": "textarea",
                "labelKey": "components.sources.postgres.query",
                "required": False,
                "secret": False,
            },
            {
                "key": "chunkSize",
                "type": "number",
                "labelKey": "components.sources.postgres.chunkSize",
                "required": False,
                "secret": False,
            },
            {
                "key": "checkpointColumn",
                "type": "text",
                "labelKey": "components.sources.postgres.checkpointColumn",
                "required": False,
                "secret": False,
            },
        ],
        "inputFamilies": [],
        "outputFamilies": ["tabular"],
    }
)

_IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]{0,62}")
_FORBIDDEN_QUERY = re.compile(
    r"\b(?:alter|call|copy|create|delete|do|drop|grant|insert|revoke|truncate|update)\b|\bfor\s+(?:share|update)\b",
    re.IGNORECASE,
)


class PostgresSourceError(RuntimeError):
    """Raised when PostgreSQL data cannot be read with safe streaming semantics."""


class PostgresSourceCursor(Protocol):
    """Cursor boundary for read-only, server-side PostgreSQL source extraction."""

    def __enter__(self) -> "PostgresSourceCursor":
        """Open the cursor context."""

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Close the cursor context."""

    def execute(self, query: str, parameters: Mapping[str, object] | None = None) -> None:
        """Execute a parameterized read-only PostgreSQL statement."""

    def fetchmany(self, size: int) -> list[Mapping[str, object]]:
        """Fetch the next bounded batch of source rows."""


class PostgresSourceConnection(Protocol):
    """Connection boundary whose transaction owns one repeatable source read."""

    def __enter__(self) -> "PostgresSourceConnection":
        """Open a transaction context for the read-only extraction."""

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        """Commit or roll back and close the extraction connection."""

    def cursor(
        self, *, name: str | None = None, row_factory: object | None = None
    ) -> PostgresSourceCursor:
        """Open a standard or server-side cursor with mapping rows."""


PostgresSourceConnectionFactory = Callable[[str], PostgresSourceConnection]


class PostgresSource:
    """Extract PostgreSQL rows in chunks without materializing the full source dataset."""

    def __init__(
        self,
        storage: DatasetStorage,
        database_url: str,
        *,
        checkpoint_lifecycle: SourceCheckpointLifecycle | None = None,
        connection_factory: PostgresSourceConnectionFactory | None = None,
        dataset_retention: timedelta = timedelta(days=1),
    ) -> None:
        """Bind secret-resolved PostgreSQL access and temporary Dataset storage."""
        if dataset_retention <= timedelta():
            raise ValueError("Dataset retention must be positive.")
        self._storage = storage
        self._database_url = validate_database_url(database_url)
        self._checkpoint_lifecycle = checkpoint_lifecycle
        self._connection_factory = connection_factory or _connect
        self._dataset_retention = dataset_retention

    def __call__(self, request: SourceExecutionRequest) -> DatasetDescriptor:
        """Execute one configured read-only query and persist its streamed tabular Dataset."""
        configuration = _PostgresSourceConfiguration.from_request(request)
        checkpoint = self._load_checkpoint(configuration)
        lifecycle = DatasetLifecycle(
            pipeline_id=request.pipelineId,
            run_id=request.runId,
            step_id=request.stepId,
            expires_at=datetime.now(UTC) + self._dataset_retention,
        )
        candidate = _CheckpointTracker(configuration.checkpoint_column)

        try:
            with self._connection_factory(self._database_url) as connection:
                with connection.cursor(row_factory=dict_row) as setup_cursor:
                    setup_cursor.execute("SET TRANSACTION READ ONLY")
                with connection.cursor(
                    name=f"pantaetl_source_{uuid4().hex}", row_factory=dict_row
                ) as cursor:
                    query = configuration.query_for_checkpoint(checkpoint)
                    parameters = {"checkpoint": checkpoint} if "%(checkpoint)s" in query else None
                    cursor.execute(query, parameters)
                    descriptor = self._storage.persist_tabular_batches(
                        self._stream_batches(cursor, configuration.chunk_size, candidate), lifecycle
                    )
        except PostgresSourceError:
            raise
        except Exception as error:
            raise PostgresSourceError("PostgreSQL source could not be read.") from error

        self._propose_checkpoint(candidate.value)
        return descriptor

    def _load_checkpoint(
        self, configuration: "_PostgresSourceConfiguration"
    ) -> CheckpointValue | None:
        if self._checkpoint_lifecycle is None or configuration.checkpoint_column is None:
            return None
        checkpoint = self._checkpoint_lifecycle.load()
        if checkpoint is None:
            return None
        if not isinstance(checkpoint, dict) or set(checkpoint) != {"value"}:
            raise PostgresSourceError("PostgreSQL checkpoint has an unsupported shape.")
        value = checkpoint["value"]
        if not isinstance(value, str | int | float | bool):
            raise PostgresSourceError("PostgreSQL checkpoint value must be a scalar.")
        return value

    def _stream_batches(
        self,
        cursor: PostgresSourceCursor,
        chunk_size: int,
        candidate: "_CheckpointTracker",
    ) -> Iterator[pl.DataFrame]:
        """Yield bounded frames from one server-side cursor without accumulating source rows."""
        while rows := cursor.fetchmany(chunk_size):
            candidate.observe(rows)
            yield pl.from_dicts(rows)

    def _propose_checkpoint(self, value: CheckpointValue | None) -> None:
        if self._checkpoint_lifecycle is not None and value is not None:
            self._checkpoint_lifecycle.propose({"value": value})


class _PostgresSourceConfiguration:
    """Validated PostgreSQL query and streaming settings extracted from a Source request."""

    def __init__(
        self,
        *,
        query: str | None,
        table: str | None,
        chunk_size: int,
        checkpoint_column: str | None,
    ) -> None:
        """Store read-only SQL and bounded extraction settings."""
        self._query = query
        self._table = table
        self.chunk_size = chunk_size
        self.checkpoint_column = checkpoint_column

    @classmethod
    def from_request(cls, request: SourceExecutionRequest) -> "_PostgresSourceConfiguration":
        """Build one query from either an explicit SELECT or a validated table name."""
        values = request.configuration.values
        table = _optional_text(values, "table")
        query = _optional_text(values, "query")
        if (table is None) == (query is None):
            raise PostgresSourceError("PostgreSQL source requires exactly one of table or query.")
        checkpoint_column = _optional_identifier(values, "checkpointColumn")
        if query is not None:
            _validate_read_only_query(query)
            if checkpoint_column is not None:
                if "%(checkpoint)s" not in query or "order by" not in query.lower():
                    raise PostgresSourceError(
                        "PostgreSQL checkpoint queries must use %(checkpoint)s and ORDER BY."
                    )
        return cls(
            query=query,
            table=table,
            chunk_size=_chunk_size(values),
            checkpoint_column=checkpoint_column,
        )

    def query_for_checkpoint(self, checkpoint: CheckpointValue | None) -> str:
        """Build the read-only table query after the prior checkpoint has been loaded."""
        if self._query is not None:
            return self._query
        return _table_query(cast(str, self._table), self.checkpoint_column, checkpoint)


class _CheckpointTracker:
    """Track one serializable checkpoint from bounded batches as rows stream from PostgreSQL."""

    def __init__(self, column: str | None) -> None:
        """Set the optional configured source column whose last value advances the checkpoint."""
        self._column = column
        self.value: CheckpointValue | None = None

    def observe(self, rows: list[Mapping[str, object]]) -> None:
        """Use the final ordered row in a batch as the next checkpoint candidate."""
        if self._column is None:
            return
        try:
            value = rows[-1][self._column]
        except KeyError as error:
            raise PostgresSourceError(
                "PostgreSQL result does not include checkpointColumn."
            ) from error
        self.value = _checkpoint_value(value)


def register_postgres_source(registry: SourceRegistry, source: PostgresSource) -> None:
    """Install the PostgreSQL Source capability without coupling it to other Sources."""
    registry.register(POSTGRES_SOURCE_METADATA, source)


def _connect(database_url: str) -> PostgresSourceConnection:
    """Open the PostgreSQL connection only after its secret URL was validated."""
    return cast(PostgresSourceConnection, psycopg.connect(database_url))


def _optional_text(values: Mapping[str, object], key: str) -> str | None:
    value = values.get(key)
    if value is None:
        return None
    value_root = getattr(value, "root", None)
    if not isinstance(value_root, str) or not value_root.strip():
        raise PostgresSourceError(f"PostgreSQL {key} configuration must be non-empty text.")
    return value_root


def _optional_identifier(values: Mapping[str, object], key: str) -> str | None:
    value = _optional_text(values, key)
    if value is None:
        return None
    if _IDENTIFIER.fullmatch(value) is None:
        raise PostgresSourceError(f"PostgreSQL {key} must use letters, digits, and underscores.")
    return value


def _chunk_size(values: Mapping[str, object]) -> int:
    value = values.get("chunkSize")
    if value is None:
        return 1_000
    value_root = getattr(value, "root", None)
    if (
        not isinstance(value_root, int | float)
        or isinstance(value_root, bool)
        or not float(value_root).is_integer()
    ):
        raise PostgresSourceError("PostgreSQL chunkSize configuration must be an integer.")
    chunk_size = int(value_root)
    if not 1 <= chunk_size <= 100_000:
        raise PostgresSourceError("PostgreSQL chunkSize must be between 1 and 100000.")
    return chunk_size


def _validate_read_only_query(query: str) -> None:
    normalized = query.strip()
    if not normalized.lower().startswith("select") or ";" in normalized:
        raise PostgresSourceError("PostgreSQL query must be one SELECT statement.")
    if _FORBIDDEN_QUERY.search(normalized) is not None:
        raise PostgresSourceError("PostgreSQL query contains an unsupported operation.")


def _table_query(
    table: str, checkpoint_column: str | None, checkpoint: CheckpointValue | None
) -> str:
    relation = _quote_relation(table)
    if checkpoint_column is None or checkpoint is None:
        return f"SELECT * FROM {relation}"
    column = _quote_identifier(checkpoint_column)
    return f"SELECT * FROM {relation} WHERE {column} > %(checkpoint)s ORDER BY {column} ASC"


def _quote_relation(value: str) -> str:
    parts = value.split(".")
    if not 1 <= len(parts) <= 2:
        raise PostgresSourceError("PostgreSQL table must be a table or schema.table name.")
    return ".".join(_quote_identifier(part) for part in parts)


def _quote_identifier(value: str) -> str:
    if _IDENTIFIER.fullmatch(value) is None:
        raise PostgresSourceError(
            "PostgreSQL identifiers must use letters, digits, and underscores."
        )
    return f'"{value}"'


def _checkpoint_value(value: object) -> CheckpointValue:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat() if value.tzinfo is not None else value.isoformat()
    if isinstance(value, UUID | Decimal):
        return str(value)
    if isinstance(value, str | int | float | bool):
        return value
    raise PostgresSourceError("PostgreSQL checkpoint column must contain a scalar value.")
