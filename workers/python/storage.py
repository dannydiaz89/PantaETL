"""Temporary Dataset storage abstractions and the local Parquet implementation."""

import json
import os
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Protocol, cast
from uuid import UUID, uuid4

import polars as pl
import pyarrow as pa  # type: ignore[import-untyped]
import pyarrow.parquet as pq  # type: ignore[import-untyped]
from cryptography.fernet import Fernet, InvalidToken

from .generated.dataset_descriptor import (
    DatasetDescriptor,
    Family,
    FieldModel,
    Kind,
    Storage,
    Structure,
)

_CHUNKED_ENCRYPTION_HEADER = b"PantaETLEncryptedChunksV1\n"
_ENCRYPTION_CHUNK_SIZE = 1024 * 1024


class DatasetStorageError(RuntimeError):
    """Raised when a temporary Dataset cannot be safely stored or read."""


class UnsupportedDatasetError(DatasetStorageError):
    """Raised when an adapter cannot handle a Dataset descriptor."""


class DatasetEncryptionError(DatasetStorageError):
    """Raised when encrypted temporary data cannot be decrypted safely."""


type JsonDocument = (
    str | int | float | bool | None | list["JsonDocument"] | dict[str, "JsonDocument"]
)


@dataclass(frozen=True, slots=True)
class DatasetLifecycle:
    """Ownership and expiry data required when storing a temporary Dataset."""

    pipeline_id: UUID
    run_id: UUID
    step_id: UUID
    expires_at: datetime


class DatasetStorage(Protocol):
    """Storage boundary that lets pipeline execution avoid backend-specific paths."""

    def persist_tabular(
        self, dataset: pl.DataFrame | pl.LazyFrame, lifecycle: DatasetLifecycle
    ) -> DatasetDescriptor:
        """Persist tabular data and return a descriptor for the stored Dataset."""

    def read_tabular(self, descriptor: DatasetDescriptor) -> pl.DataFrame:
        """Load a previously persisted tabular Dataset from its descriptor."""

    def persist_tabular_batches(
        self, batches: Iterable[pl.DataFrame], lifecycle: DatasetLifecycle
    ) -> DatasetDescriptor:
        """Persist tabular batches without requiring the complete source in memory."""

    def scan_tabular(self, descriptor: DatasetDescriptor) -> pl.LazyFrame:
        """Open a previously persisted tabular Dataset without eagerly collecting it."""

    def persist_document(
        self, document: JsonDocument, lifecycle: DatasetLifecycle
    ) -> DatasetDescriptor:
        """Persist a JSON document and return a descriptor for the stored Dataset."""

    def read_document(self, descriptor: DatasetDescriptor) -> JsonDocument:
        """Load a previously persisted JSON document from its descriptor."""

    def delete(self, descriptor: DatasetDescriptor) -> bool:
        """Delete a temporary Dataset, returning whether storage was removed."""

    def size_bytes(self, descriptor: DatasetDescriptor) -> int:
        """Return the stored byte count for a temporary Dataset descriptor."""


class LocalDatasetStorage:
    """Store temporary tabular and document Datasets beneath one local root.

    Locations in descriptors are root-relative POSIX paths. The adapter rejects
    traversal and validates descriptors before touching the filesystem.
    """

    def __init__(self, root: Path | str, *, encryption_key: bytes | str | None = None) -> None:
        """Create a local adapter, optionally encrypting new Dataset files at rest."""
        self._root = Path(root).resolve()
        key = encryption_key.encode("utf-8") if isinstance(encryption_key, str) else encryption_key
        try:
            self._cipher = Fernet(key) if key is not None else None
        except (TypeError, ValueError) as error:
            raise ValueError("Dataset encryption key must be a valid Fernet key.") from error

    def persist_tabular(
        self, dataset: pl.DataFrame | pl.LazyFrame, lifecycle: DatasetLifecycle
    ) -> DatasetDescriptor:
        """Write a tabular Dataset atomically and describe its temporary lifecycle."""
        now = self._validate_lifecycle(lifecycle)

        frame = dataset.collect() if isinstance(dataset, pl.LazyFrame) else dataset
        dataset_id = uuid4()
        encrypted = self._cipher is not None
        location = self._build_location(lifecycle.run_id, dataset_id, "parquet", encrypted)
        payload = self._serialize_parquet(frame)
        if self._cipher is not None:
            payload = self._cipher.encrypt(payload)

        self._write_atomically(self._path_for_location(location), payload)
        return DatasetDescriptor(
            contractVersion="v1",
            id=dataset_id,
            family=Family.tabular,
            format="parquet",
            storage=Storage(kind=Kind.local, location=location.as_posix(), encrypted=encrypted),
            structure=self._describe_structure(frame),
            pipelineId=lifecycle.pipeline_id,
            runId=lifecycle.run_id,
            stepId=lifecycle.step_id,
            createdAt=now,
            expiresAt=lifecycle.expires_at,
        )

    def persist_tabular_batches(
        self, batches: Iterable[pl.DataFrame], lifecycle: DatasetLifecycle
    ) -> DatasetDescriptor:
        """Stream tabular batches into one temporary Parquet Dataset atomically."""
        now = self._validate_lifecycle(lifecycle)
        frames = iter(batches)
        try:
            first_frame = next(frames)
        except StopIteration:
            first_frame = pl.DataFrame()

        dataset_id = uuid4()
        encrypted = self._cipher is not None
        location = self._build_location(lifecycle.run_id, dataset_id, "parquet", encrypted)
        schema = first_frame.to_arrow().schema
        self._write_parquet_batches(
            self._path_for_location(location),
            _with_first_frame(first_frame, frames),
            schema,
            encrypted=encrypted,
        )
        return DatasetDescriptor(
            contractVersion="v1",
            id=dataset_id,
            family=Family.tabular,
            format="parquet",
            storage=Storage(kind=Kind.local, location=location.as_posix(), encrypted=encrypted),
            structure=self._describe_arrow_structure(schema),
            pipelineId=lifecycle.pipeline_id,
            runId=lifecycle.run_id,
            stepId=lifecycle.step_id,
            createdAt=now,
            expiresAt=lifecycle.expires_at,
        )

    def persist_document(
        self, document: JsonDocument, lifecycle: DatasetLifecycle
    ) -> DatasetDescriptor:
        """Write a JSON document atomically and describe its temporary lifecycle."""
        now = self._validate_lifecycle(lifecycle)
        try:
            payload = json.dumps(
                document, allow_nan=False, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
        except (TypeError, ValueError) as error:
            raise DatasetStorageError("Document dataset is not valid JSON.") from error

        dataset_id = uuid4()
        encrypted = self._cipher is not None
        location = self._build_location(lifecycle.run_id, dataset_id, "json", encrypted)
        if self._cipher is not None:
            payload = self._cipher.encrypt(payload)

        self._write_atomically(self._path_for_location(location), payload)
        return DatasetDescriptor(
            contractVersion="v1",
            id=dataset_id,
            family=Family.document,
            format="json",
            storage=Storage(kind=Kind.local, location=location.as_posix(), encrypted=encrypted),
            structure=Structure(format="json"),
            pipelineId=lifecycle.pipeline_id,
            runId=lifecycle.run_id,
            stepId=lifecycle.step_id,
            createdAt=now,
            expiresAt=lifecycle.expires_at,
        )

    def read_tabular(self, descriptor: DatasetDescriptor) -> pl.DataFrame:
        """Read a local Parquet Dataset and decrypt it when its descriptor requires it."""
        payload = self._read_payload(descriptor, Family.tabular, "parquet")
        try:
            table = pq.read_table(pa.BufferReader(payload))
        except (OSError, pa.ArrowException) as error:
            raise DatasetStorageError(
                f"Temporary dataset is not valid Parquet: {descriptor.id}."
            ) from error
        return cast(pl.DataFrame, pl.from_arrow(table))

    def scan_tabular(self, descriptor: DatasetDescriptor) -> pl.LazyFrame:
        """Open an unencrypted local Parquet Dataset lazily for streaming Export sinks."""
        if descriptor.storage.encrypted:
            raise DatasetEncryptionError(
                "Encrypted temporary datasets cannot be scanned without materialization."
            )
        return pl.scan_parquet(self._path_for_descriptor(descriptor, Family.tabular, "parquet"))

    def read_document(self, descriptor: DatasetDescriptor) -> JsonDocument:
        """Read a local JSON Dataset and decrypt it when its descriptor requires it."""
        payload = self._read_payload(descriptor, Family.document, "json")
        try:
            return cast(JsonDocument, json.loads(payload))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise DatasetStorageError(
                f"Temporary dataset is not valid JSON: {descriptor.id}."
            ) from error

    def delete(self, descriptor: DatasetDescriptor) -> bool:
        """Remove one temporary Dataset without failing if prior cleanup removed it."""
        if descriptor.storage.kind != Kind.local:
            raise UnsupportedDatasetError("Local storage cannot resolve a non-local Dataset.")
        path = self._path_for_location(PurePosixPath(descriptor.storage.location))
        try:
            path.unlink()
        except FileNotFoundError:
            return False
        return True

    def size_bytes(self, descriptor: DatasetDescriptor) -> int:
        """Read one stored Dataset's byte count before terminal cleanup removes it."""
        if descriptor.storage.kind != Kind.local:
            raise UnsupportedDatasetError("Local storage cannot resolve a non-local Dataset.")
        path = self._path_for_location(PurePosixPath(descriptor.storage.location))
        try:
            return path.stat().st_size
        except OSError as error:
            raise DatasetStorageError("Temporary dataset storage is unavailable.") from error

    def delete_expired(
        self, descriptors: Iterable[DatasetDescriptor], *, now: datetime | None = None
    ) -> list[UUID]:
        """Remove expired Dataset files so terminal cleanup can be safely retried."""
        current_time = now or datetime.now(UTC)
        if current_time.tzinfo is None:
            raise ValueError("Cleanup time must include a timezone.")

        deleted_ids: list[UUID] = []
        for descriptor in descriptors:
            if descriptor.expiresAt <= current_time and self.delete(descriptor):
                deleted_ids.append(descriptor.id)
        return deleted_ids

    def _validate_lifecycle(self, lifecycle: DatasetLifecycle) -> datetime:
        """Validate temporal lifecycle metadata before persisting temporary data."""
        now = datetime.now(UTC)
        if lifecycle.expires_at.tzinfo is None:
            raise ValueError("Dataset expiry must include a timezone.")
        if lifecycle.expires_at <= now:
            raise ValueError("Dataset expiry must be in the future.")
        return now

    def _build_location(
        self, run_id: UUID, dataset_id: UUID, dataset_format: str, encrypted: bool
    ) -> PurePosixPath:
        suffix = f".{dataset_format}.enc" if encrypted else f".{dataset_format}"
        return PurePosixPath("runs") / str(run_id) / "datasets" / f"{dataset_id}{suffix}"

    def _read_payload(
        self, descriptor: DatasetDescriptor, family: Family, dataset_format: str
    ) -> bytes:
        """Load and decrypt one local Dataset after checking its declared contract family."""
        path = self._path_for_descriptor(descriptor, family, dataset_format)
        try:
            payload = path.read_bytes()
        except FileNotFoundError as error:
            raise DatasetStorageError(
                f"Temporary dataset does not exist: {descriptor.id}."
            ) from error

        if descriptor.storage.encrypted:
            if self._cipher is None:
                raise DatasetEncryptionError(
                    "An encryption key is required to read this temporary dataset."
                )
            try:
                payload = self._decrypt_payload(payload)
            except InvalidToken as error:
                raise DatasetEncryptionError(
                    "Temporary dataset encryption could not be verified."
                ) from error
        return payload

    def _path_for_descriptor(
        self, descriptor: DatasetDescriptor, family: Family, dataset_format: str
    ) -> Path:
        if descriptor.family != family or descriptor.format != dataset_format:
            raise UnsupportedDatasetError(
                f"Local storage cannot read {descriptor.family} Dataset as {dataset_format}."
            )
        if descriptor.storage.kind != Kind.local:
            raise UnsupportedDatasetError("Local storage cannot resolve a non-local Dataset.")
        return self._path_for_location(PurePosixPath(descriptor.storage.location))

    def _path_for_location(self, location: PurePosixPath) -> Path:
        if location.is_absolute() or ".." in location.parts or location == PurePosixPath("."):
            raise DatasetStorageError("Dataset storage location must be a safe relative path.")

        path = (self._root / Path(*location.parts)).resolve()
        if not path.is_relative_to(self._root):
            raise DatasetStorageError("Dataset storage location escapes the configured root.")
        return path

    def _write_atomically(self, destination: Path, payload: bytes) -> None:
        destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        temporary = destination.with_name(f".{destination.name}.{uuid4().hex}.tmp")
        try:
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "wb") as output:
                output.write(payload)
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)

    def _write_parquet_batches(
        self,
        destination: Path,
        batches: Iterable[pl.DataFrame],
        schema: pa.Schema,
        *,
        encrypted: bool,
    ) -> None:
        """Write Parquet batches through private staging files before one atomic publish."""
        destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        staged = destination.with_name(f".{destination.name}.{uuid4().hex}.parquet.tmp")
        encrypted_staged = destination.with_name(f".{destination.name}.{uuid4().hex}.enc.tmp")
        try:
            descriptor = os.open(staged, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "wb") as output:
                with pq.ParquetWriter(output, schema, compression="zstd") as writer:
                    for frame in batches:
                        table = frame.to_arrow()
                        if table.schema != schema:
                            table = table.cast(schema)
                        writer.write_table(table)

            if encrypted:
                self._encrypt_file(staged, encrypted_staged)
                encrypted_staged.replace(destination)
            else:
                staged.replace(destination)
        except (OSError, pa.ArrowException, pl.exceptions.PolarsError, ValueError) as error:
            raise DatasetStorageError("Temporary tabular dataset could not be stored.") from error
        finally:
            staged.unlink(missing_ok=True)
            encrypted_staged.unlink(missing_ok=True)

    def _encrypt_file(self, source: Path, destination: Path) -> None:
        """Encrypt a staged Dataset in bounded chunks so large Sources remain streamable."""
        if self._cipher is None:
            raise DatasetEncryptionError("Dataset encryption is not configured.")
        descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with source.open("rb") as input_file, os.fdopen(descriptor, "wb") as output_file:
            output_file.write(_CHUNKED_ENCRYPTION_HEADER)
            while chunk := input_file.read(_ENCRYPTION_CHUNK_SIZE):
                encrypted_chunk = self._cipher.encrypt(chunk)
                output_file.write(len(encrypted_chunk).to_bytes(4, "big"))
                output_file.write(encrypted_chunk)

    def _decrypt_payload(self, payload: bytes) -> bytes:
        """Decrypt both legacy whole-file tokens and current bounded encrypted chunks."""
        if self._cipher is None:
            raise DatasetEncryptionError("Dataset encryption is not configured.")
        if not payload.startswith(_CHUNKED_ENCRYPTION_HEADER):
            return self._cipher.decrypt(payload)

        offset = len(_CHUNKED_ENCRYPTION_HEADER)
        chunks: list[bytes] = []
        while offset < len(payload):
            if offset + 4 > len(payload):
                raise InvalidToken
            length = int.from_bytes(payload[offset : offset + 4], "big")
            offset += 4
            if length <= 0 or offset + length > len(payload):
                raise InvalidToken
            chunks.append(self._cipher.decrypt(payload[offset : offset + length]))
            offset += length
        return b"".join(chunks)

    def _serialize_parquet(self, frame: pl.DataFrame) -> bytes:
        sink = pa.BufferOutputStream()
        pq.write_table(frame.to_arrow(), sink, compression="zstd")
        return cast(bytes, sink.getvalue().to_pybytes())

    def _describe_structure(self, frame: pl.DataFrame) -> Structure:
        return self._describe_arrow_structure(frame.to_arrow().schema)

    def _describe_arrow_structure(self, table_schema: pa.Schema) -> Structure:
        """Describe a Parquet-compatible Arrow schema for its Dataset descriptor."""
        return Structure(
            format="parquet",
            fields=[
                FieldModel(name=field.name, type=str(field.type), nullable=field.nullable)
                for field in table_schema
            ],
        )


def _with_first_frame(
    first_frame: pl.DataFrame, remaining_frames: Iterator[pl.DataFrame]
) -> Iterator[pl.DataFrame]:
    """Yield a prefetched first frame before continuing the streaming iterator."""
    yield first_frame
    yield from remaining_frames
