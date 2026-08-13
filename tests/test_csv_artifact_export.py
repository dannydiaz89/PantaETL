"""Tests for CSV artifact publication and durable retention metadata."""

from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import polars as pl
import pytest

from workers.python.artifacts import (
    ArtifactPublicationError,
    ArtifactPublisher,
    ArtifactStorageError,
    LocalArtifactStorage,
)
from workers.python.components.exports.csv_artifact import CSVArtifactExport, CSVArtifactExportError
from workers.python.generated.artifact_descriptor import ArtifactDescriptor
from workers.python.generated.dataset_descriptor import DatasetDescriptor
from workers.python.storage import DatasetLifecycle, LocalDatasetStorage

PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")
STEP_ID = UUID("00000000-0000-0000-0000-000000000003")


class RecordingMetadataStore:
    """In-memory metadata recorder used to prove publication ordering in unit tests."""

    def __init__(self) -> None:
        """Create a recorder with no durable artifact records."""
        self.descriptors: list[ArtifactDescriptor] = []

    def record(self, descriptor: ArtifactDescriptor) -> None:
        """Record the finalized descriptor passed by the publisher."""
        self.descriptors.append(descriptor)


class FailingMetadataStore:
    """Metadata boundary that simulates a safe database recording failure."""

    def record(self, _descriptor: ArtifactDescriptor) -> None:
        """Raise without exposing any artifact content."""
        raise RuntimeError("database unavailable")


def _dataset(storage: LocalDatasetStorage) -> DatasetDescriptor:
    return storage.persist_tabular(
        pl.DataFrame({"order_id": [1, 2], "total": [12.5, 9.0]}),
        DatasetLifecycle(
            pipeline_id=PIPELINE_ID,
            run_id=RUN_ID,
            step_id=STEP_ID,
            expires_at=datetime(2026, 8, 14, tzinfo=UTC),
        ),
    )


def test_csv_export_finalizes_file_and_records_default_thirty_day_retention(tmp_path: Path) -> None:
    """CSV output is durable before its explicit artifact expiry metadata is recorded."""
    datasets = LocalDatasetStorage(tmp_path / "datasets")
    output = LocalArtifactStorage(tmp_path / "artifacts")
    metadata = RecordingMetadataStore()

    descriptor = CSVArtifactExport(datasets, ArtifactPublisher(output, metadata))(
        _dataset(datasets), {"fileName": "orders.csv"}
    )

    artifact_path = tmp_path / "artifacts" / descriptor.storage.location
    assert artifact_path.read_text(encoding="utf-8") == "order_id,total\n1,12.5\n2,9.0\n"
    assert metadata.descriptors == [descriptor]
    assert descriptor.retention.retentionDays == 30


def test_csv_export_cleans_finalized_file_when_metadata_recording_fails(tmp_path: Path) -> None:
    """A retry never sees a partial final file after a failed publication attempt."""
    datasets = LocalDatasetStorage(tmp_path / "datasets")
    output = LocalArtifactStorage(tmp_path / "artifacts")
    export = CSVArtifactExport(datasets, ArtifactPublisher(output, FailingMetadataStore()))

    with pytest.raises(ArtifactPublicationError, match="metadata could not be recorded"):
        export(_dataset(datasets), {"fileName": "orders.csv"})

    assert list((tmp_path / "artifacts").rglob("*.csv")) == []
    assert list((tmp_path / "artifacts").rglob("*.tmp")) == []


def test_csv_export_rejects_unsafe_output_names_before_writing(tmp_path: Path) -> None:
    """Artifact paths cannot escape the configured retained-output root."""
    datasets = LocalDatasetStorage(tmp_path / "datasets")
    export = CSVArtifactExport(
        datasets,
        ArtifactPublisher(LocalArtifactStorage(tmp_path / "artifacts"), RecordingMetadataStore()),
    )

    with pytest.raises(CSVArtifactExportError, match="fileName"):
        export(_dataset(datasets), {})
    with pytest.raises(ArtifactStorageError, match="safe file name"):
        export(_dataset(datasets), {"fileName": "../orders.csv"})
