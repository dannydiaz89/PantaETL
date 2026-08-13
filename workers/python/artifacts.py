"""Retained artifact publication with local atomic finalization and metadata recording."""

import os
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Protocol, cast
from uuid import UUID, uuid4

import psycopg

from .generated.artifact_descriptor import ArtifactDescriptor, Kind, Retention, Storage
from .job_queue import ConnectionFactory, JobQueueConnection, validate_database_url

DEFAULT_ARTIFACT_RETENTION = timedelta(days=30)


class ArtifactStorageError(RuntimeError):
    """Raised when a retained artifact cannot be safely stored or removed."""


class ArtifactMetadataError(RuntimeError):
    """Raised when durable artifact metadata cannot be recorded safely."""


class ArtifactPublicationError(RuntimeError):
    """Raised when final artifact publication cannot complete without an orphaned file."""


@dataclass(frozen=True, slots=True)
class ArtifactLifecycle:
    """Ownership and expiry information required for one retained file output."""

    pipeline_id: UUID
    run_id: UUID
    expires_at: datetime

    @classmethod
    def default(cls, pipeline_id: UUID, run_id: UUID) -> "ArtifactLifecycle":
        """Create a lifecycle using the standard thirty-day artifact retention period."""
        return cls(
            pipeline_id=pipeline_id,
            run_id=run_id,
            expires_at=datetime.now(UTC) + DEFAULT_ARTIFACT_RETENTION,
        )


ArtifactWriter = Callable[[Path], None]


class ArtifactStorage(Protocol):
    """Storage boundary for finalized retained artifacts."""

    def write_atomically(
        self,
        lifecycle: ArtifactLifecycle,
        *,
        format: str,
        content_type: str | None,
        file_name: str,
        writer: ArtifactWriter,
    ) -> ArtifactDescriptor:
        """Write through a temporary file and return a finalized artifact descriptor."""

    def delete(self, descriptor: ArtifactDescriptor) -> bool:
        """Delete one retained artifact, returning whether storage was removed."""


class ArtifactMetadataStore(Protocol):
    """Durable metadata boundary used only after artifact file finalization."""

    def record(self, descriptor: ArtifactDescriptor) -> None:
        """Record one finalized retained artifact and its explicit expiry metadata."""


class LocalArtifactStorage:
    """Store retained artifacts beneath one root using same-filesystem atomic moves."""

    def __init__(self, root: Path | str) -> None:
        """Configure the root directory used for all local retained artifact files."""
        self._root = Path(root).resolve()

    def write_atomically(
        self,
        lifecycle: ArtifactLifecycle,
        *,
        format: str,
        content_type: str | None,
        file_name: str,
        writer: ArtifactWriter,
    ) -> ArtifactDescriptor:
        """Replace the final path only after a successful temporary-file write."""
        if lifecycle.expires_at.tzinfo is None:
            raise ValueError("Artifact expiry must include a timezone.")
        if lifecycle.expires_at <= datetime.now(UTC):
            raise ValueError("Artifact expiry must be in the future.")
        if not format:
            raise ArtifactStorageError("Artifact format is required.")

        artifact_id = uuid4()
        safe_name = self._validate_file_name(file_name)
        location = (
            PurePosixPath("runs")
            / str(lifecycle.run_id)
            / "artifacts"
            / (f"{artifact_id}-{safe_name}")
        )
        destination = self._path_for_location(location)
        destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        temporary = destination.with_name(f".{destination.name}.{uuid4().hex}.tmp")

        try:
            writer(temporary)
            if not temporary.is_file():
                raise ArtifactStorageError("Artifact writer did not create an output file.")
            size_bytes = temporary.stat().st_size
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)

        created_at = datetime.now(UTC)
        return ArtifactDescriptor(
            contractVersion="v1",
            id=artifact_id,
            pipelineId=lifecycle.pipeline_id,
            runId=lifecycle.run_id,
            format=format,
            contentType=content_type,
            fileName=safe_name,
            sizeBytes=size_bytes,
            storage=Storage(kind=Kind.local, location=location.as_posix(), encrypted=False),
            createdAt=created_at,
            retention=Retention(
                expiresAt=lifecycle.expires_at,
                retentionDays=_retention_days(created_at, lifecycle.expires_at),
            ),
        )

    def delete(self, descriptor: ArtifactDescriptor) -> bool:
        """Remove an artifact file without failing when prior cleanup removed it."""
        if descriptor.storage.kind is not Kind.local:
            raise ArtifactStorageError(
                "Local artifact storage cannot resolve a non-local artifact."
            )
        path = self._path_for_location(PurePosixPath(descriptor.storage.location))
        try:
            path.unlink()
        except FileNotFoundError:
            return False
        return True

    def _path_for_location(self, location: PurePosixPath) -> Path:
        if location.is_absolute() or ".." in location.parts or location == PurePosixPath("."):
            raise ArtifactStorageError("Artifact storage location must be a safe relative path.")
        path = (self._root / Path(*location.parts)).resolve()
        if not path.is_relative_to(self._root):
            raise ArtifactStorageError("Artifact storage location escapes the configured root.")
        return path

    def _validate_file_name(self, value: str) -> str:
        location = PurePosixPath(value)
        if not value or location.name != value or value in {".", ".."} or "\x00" in value:
            raise ArtifactStorageError("Artifact file name must be a safe file name.")
        return value


class PostgresArtifactMetadataStore:
    """Record finalized artifact metadata in short PostgreSQL transactions."""

    def __init__(
        self,
        database_url: str,
        *,
        connection_factory: ConnectionFactory | None = None,
    ) -> None:
        """Configure metadata storage without opening a PostgreSQL connection."""
        self._database_url = validate_database_url(database_url)
        self._connection_factory = connection_factory or _connect

    def record(self, descriptor: ArtifactDescriptor) -> None:
        """Insert metadata only for a fully finalized artifact file."""
        try:
            with self._connection_factory(self._database_url) as connection:
                with connection.cursor(row_factory=None) as cursor:
                    cursor.execute(
                        _INSERT_ARTIFACT,
                        {
                            "id": descriptor.id,
                            "pipeline_id": descriptor.pipelineId,
                            "run_id": descriptor.runId,
                            "format": descriptor.format,
                            "content_type": descriptor.contentType,
                            "file_name": descriptor.fileName,
                            "size_bytes": descriptor.sizeBytes,
                            "storage_kind": descriptor.storage.kind.value,
                            "storage_location": descriptor.storage.location,
                            "encrypted": descriptor.storage.encrypted,
                            "created_at": descriptor.createdAt,
                            "expires_at": descriptor.retention.expiresAt,
                        },
                    )
        except Exception as error:
            raise ArtifactMetadataError("Artifact metadata could not be recorded.") from error


class ArtifactPublisher:
    """Finalize artifact files before durably recording their cleanup metadata."""

    def __init__(self, storage: ArtifactStorage, metadata_store: ArtifactMetadataStore) -> None:
        """Bind artifact storage and its durable metadata store."""
        self._storage = storage
        self._metadata_store = metadata_store

    def publish(
        self,
        lifecycle: ArtifactLifecycle,
        *,
        format: str,
        content_type: str | None,
        file_name: str,
        writer: ArtifactWriter,
    ) -> ArtifactDescriptor:
        """Finalize a file, then record metadata or remove it if metadata insertion fails."""
        descriptor = self._storage.write_atomically(
            lifecycle,
            format=format,
            content_type=content_type,
            file_name=file_name,
            writer=writer,
        )
        try:
            self._metadata_store.record(descriptor)
        except Exception as error:
            try:
                self._storage.delete(descriptor)
            except Exception as cleanup_error:
                raise ArtifactPublicationError(
                    "Artifact metadata failed and finalized storage could not be cleaned up."
                ) from cleanup_error
            raise ArtifactPublicationError("Artifact metadata could not be recorded.") from error
        return descriptor


_INSERT_ARTIFACT = """
INSERT INTO artifacts (
  id, pipeline_id, run_id, format, content_type, file_name, size_bytes,
  storage_kind, storage_location, encrypted, created_at, expires_at
)
VALUES (
  %(id)s, %(pipeline_id)s, %(run_id)s, %(format)s, %(content_type)s, %(file_name)s,
  %(size_bytes)s, %(storage_kind)s::artifact_storage_kind, %(storage_location)s,
  %(encrypted)s, %(created_at)s, %(expires_at)s
)
"""


def _connect(database_url: str) -> JobQueueConnection:
    """Open one PostgreSQL connection for a short metadata insertion transaction."""
    return cast(JobQueueConnection, psycopg.connect(database_url))


def _retention_days(created_at: datetime, expires_at: datetime) -> int:
    """Calculate a whole positive retention duration for the artifact contract."""
    return max(1, round((expires_at - created_at) / timedelta(days=1)))
