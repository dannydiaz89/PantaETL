"""Temporary Dataset storage abstractions and the local Parquet implementation."""

import os
from collections.abc import Iterable
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


class DatasetStorageError(RuntimeError):
    """Raised when a temporary Dataset cannot be safely stored or read."""


class UnsupportedDatasetError(DatasetStorageError):
    """Raised when an adapter cannot handle a Dataset descriptor."""


class DatasetEncryptionError(DatasetStorageError):
    """Raised when encrypted temporary data cannot be decrypted safely."""


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

    def delete(self, descriptor: DatasetDescriptor) -> bool:
        """Delete a temporary Dataset, returning whether storage was removed."""


class LocalDatasetStorage:
    """Store temporary tabular Datasets as local Parquet files beneath one root.

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
        now = datetime.now(UTC)
        if lifecycle.expires_at.tzinfo is None:
            raise ValueError("Dataset expiry must include a timezone.")
        if lifecycle.expires_at <= now:
            raise ValueError("Dataset expiry must be in the future.")

        frame = dataset.collect() if isinstance(dataset, pl.LazyFrame) else dataset
        dataset_id = uuid4()
        encrypted = self._cipher is not None
        location = self._build_location(lifecycle.run_id, dataset_id, encrypted)
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

    def read_tabular(self, descriptor: DatasetDescriptor) -> pl.DataFrame:
        """Read a local Parquet Dataset and decrypt it when its descriptor requires it."""
        path = self._path_for_descriptor(descriptor)
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
                payload = self._cipher.decrypt(payload)
            except InvalidToken as error:
                raise DatasetEncryptionError(
                    "Temporary dataset encryption could not be verified."
                ) from error

        try:
            table = pq.read_table(pa.BufferReader(payload))
        except (OSError, pa.ArrowException) as error:
            raise DatasetStorageError(
                f"Temporary dataset is not valid Parquet: {descriptor.id}."
            ) from error
        return cast(pl.DataFrame, pl.from_arrow(table))

    def delete(self, descriptor: DatasetDescriptor) -> bool:
        """Remove one temporary Dataset without failing if prior cleanup removed it."""
        path = self._path_for_descriptor(descriptor)
        try:
            path.unlink()
        except FileNotFoundError:
            return False
        return True

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

    def _build_location(self, run_id: UUID, dataset_id: UUID, encrypted: bool) -> PurePosixPath:
        suffix = ".parquet.enc" if encrypted else ".parquet"
        return PurePosixPath("runs") / str(run_id) / "datasets" / f"{dataset_id}{suffix}"

    def _path_for_descriptor(self, descriptor: DatasetDescriptor) -> Path:
        if descriptor.family != Family.tabular or descriptor.format != "parquet":
            raise UnsupportedDatasetError("Local storage only supports tabular Parquet Datasets.")
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

    def _serialize_parquet(self, frame: pl.DataFrame) -> bytes:
        sink = pa.BufferOutputStream()
        pq.write_table(frame.to_arrow(), sink, compression="zstd")
        return cast(bytes, sink.getvalue().to_pybytes())

    def _describe_structure(self, frame: pl.DataFrame) -> Structure:
        table_schema = frame.to_arrow().schema
        return Structure(
            format="parquet",
            fields=[
                FieldModel(name=field.name, type=str(field.type), nullable=field.nullable)
                for field in table_schema
            ],
        )
