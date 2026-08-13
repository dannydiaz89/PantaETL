"""Tests for local temporary Dataset storage."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import polars as pl
import pytest
from cryptography.fernet import Fernet

from workers.python.generated.dataset_descriptor import DatasetDescriptor, Family, Kind, Storage
from workers.python.storage import (
    DatasetEncryptionError,
    DatasetLifecycle,
    DatasetStorage,
    DatasetStorageError,
    JsonDocument,
    LocalDatasetStorage,
)

PIPELINE_ID = UUID("123e4567-e89b-12d3-a456-426614174011")
RUN_ID = UUID("123e4567-e89b-12d3-a456-426614174012")
STEP_ID = UUID("123e4567-e89b-12d3-a456-426614174013")


def _lifecycle() -> DatasetLifecycle:
    """Build valid temporary ownership data for a stored Dataset."""
    return DatasetLifecycle(
        pipeline_id=PIPELINE_ID,
        run_id=RUN_ID,
        step_id=STEP_ID,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
    )


def _persist_through_boundary(
    storage: DatasetStorage, frame: pl.DataFrame, lifecycle: DatasetLifecycle
) -> DatasetDescriptor:
    """Exercise the storage abstraction without depending on a local path."""
    return storage.persist_tabular(frame, lifecycle)


def test_local_storage_persists_reads_and_cleans_tabular_datasets(tmp_path: Path) -> None:
    """Round-trip a Parquet Dataset and remove it through its contract descriptor."""
    storage = LocalDatasetStorage(tmp_path)
    frame = pl.DataFrame({"id": [1, 2], "name": ["one", "two"]})

    descriptor = _persist_through_boundary(storage, frame, _lifecycle())

    assert descriptor.family == Family.tabular
    assert descriptor.format == "parquet"
    assert descriptor.storage == Storage(
        kind=Kind.local,
        location=f"runs/{RUN_ID}/datasets/{descriptor.id}.parquet",
        encrypted=False,
    )
    assert descriptor.structure is not None
    assert [field.name for field in descriptor.structure.fields or []] == ["id", "name"]
    assert storage.read_tabular(descriptor).equals(frame)
    assert storage.delete(descriptor) is True
    assert storage.delete(descriptor) is False


def test_local_storage_encrypts_temporary_parquet_when_given_a_key(tmp_path: Path) -> None:
    """Keep encrypted temporary Dataset bytes unreadable without the configured key."""
    key = Fernet.generate_key()
    encrypted_storage = LocalDatasetStorage(tmp_path, encryption_key=key)
    frame = pl.DataFrame({"id": [1], "value": ["private"]})

    descriptor = encrypted_storage.persist_tabular(frame.lazy(), _lifecycle())
    stored_bytes = (tmp_path / descriptor.storage.location).read_bytes()

    assert descriptor.storage.encrypted is True
    assert descriptor.storage.location.endswith(".parquet.enc")
    assert not stored_bytes.startswith(b"PAR1")
    assert encrypted_storage.read_tabular(descriptor).equals(frame)
    with pytest.raises(DatasetEncryptionError, match="encryption key"):
        LocalDatasetStorage(tmp_path).read_tabular(descriptor)


def test_local_storage_persists_reads_and_encrypts_document_datasets(tmp_path: Path) -> None:
    """JSON documents retain their contract family and stay encrypted when configured."""
    key = Fernet.generate_key()
    storage = LocalDatasetStorage(tmp_path, encryption_key=key)
    document: JsonDocument = {"orders": [{"id": 1, "total": 12.5}], "source": "fixture"}

    descriptor = storage.persist_document(document, _lifecycle())
    stored_bytes = (tmp_path / descriptor.storage.location).read_bytes()

    assert descriptor.family == Family.document
    assert descriptor.format == "json"
    assert descriptor.storage.encrypted is True
    assert descriptor.storage.location.endswith(".json.enc")
    assert b"fixture" not in stored_bytes
    assert storage.read_document(descriptor) == document
    with pytest.raises(DatasetEncryptionError, match="encryption key"):
        LocalDatasetStorage(tmp_path).read_document(descriptor)


def test_local_storage_rejects_unsafe_descriptor_locations(tmp_path: Path) -> None:
    """Never resolve externally supplied storage locations outside the local root."""
    descriptor = DatasetDescriptor(
        contractVersion="v1",
        id=UUID("123e4567-e89b-12d3-a456-426614174014"),
        family=Family.tabular,
        format="parquet",
        storage=Storage(kind=Kind.local, location="../outside.parquet", encrypted=False),
        pipelineId=PIPELINE_ID,
        runId=RUN_ID,
        stepId=STEP_ID,
        createdAt=datetime.now(UTC),
        expiresAt=datetime.now(UTC) + timedelta(hours=1),
    )

    with pytest.raises(DatasetStorageError, match="safe relative path"):
        LocalDatasetStorage(tmp_path).read_tabular(descriptor)


def test_expired_datasets_are_removed_by_lifecycle_cleanup(tmp_path: Path) -> None:
    """Use descriptor expiry metadata to make terminal cleanup retries idempotent."""
    storage = LocalDatasetStorage(tmp_path)
    descriptor = storage.persist_tabular(pl.DataFrame({"id": [1]}), _lifecycle())
    expired_descriptor = descriptor.model_copy(
        update={"expiresAt": datetime.now(UTC) - timedelta(seconds=1)}
    )

    assert storage.delete_expired([descriptor, expired_descriptor]) == [descriptor.id]
    assert storage.delete_expired([expired_descriptor]) == []
