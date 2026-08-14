"""Tests for streaming Parquet artifact publication."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import polars as pl
import pytest

from workers.python.artifacts import ArtifactPublisher, LocalArtifactStorage
from workers.python.components.exports.parquet_artifact import (
    ParquetArtifactExport,
    ParquetArtifactExportError,
)
from workers.python.generated.artifact_descriptor import ArtifactDescriptor
from workers.python.generated.dataset_descriptor import DatasetDescriptor
from workers.python.storage import DatasetLifecycle, LocalDatasetStorage

PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")
STEP_ID = UUID("00000000-0000-0000-0000-000000000003")


class RecordingMetadataStore:
    """In-memory recorder that confirms Parquet artifacts retain durable metadata."""

    def __init__(self) -> None:
        """Create an empty metadata recorder."""
        self.descriptors: list[ArtifactDescriptor] = []

    def record(self, descriptor: ArtifactDescriptor) -> None:
        """Record the artifact once its temporary output has been finalized."""
        self.descriptors.append(descriptor)


def _dataset(storage: LocalDatasetStorage) -> DatasetDescriptor:
    return storage.persist_tabular(
        pl.DataFrame({"order_id": range(10_000), "total": [12.5] * 10_000}),
        DatasetLifecycle(
            pipeline_id=PIPELINE_ID,
            run_id=RUN_ID,
            step_id=STEP_ID,
            expires_at=datetime.now(UTC) + timedelta(days=1),
        ),
    )


def test_parquet_export_uses_lazy_scan_and_streaming_sink(tmp_path: Path) -> None:
    """The exporter delegates output to a lazy sink without eager Dataset reads."""
    datasets = LocalDatasetStorage(tmp_path / "datasets")
    metadata = RecordingMetadataStore()
    export = ParquetArtifactExport(
        datasets,
        ArtifactPublisher(LocalArtifactStorage(tmp_path / "artifacts"), metadata),
    )

    descriptor = export(_dataset(datasets), {"fileName": "orders.parquet"})

    artifact_path = tmp_path / "artifacts" / descriptor.storage.location
    assert pl.scan_parquet(artifact_path).select(pl.len()).collect().item() == 10_000
    assert metadata.descriptors == [descriptor]
    assert descriptor.format == "parquet"
    assert descriptor.contentType == "application/vnd.apache.parquet"


def test_parquet_export_requires_an_unencrypted_lazy_dataset(tmp_path: Path) -> None:
    """Encrypted storage never silently falls back to materializing large data in memory."""
    encryption_key = "oeBEOwgnku4z7xYqJuc_UxfbjwnFAMdF96zsvoJstyU="
    datasets = LocalDatasetStorage(tmp_path / "datasets", encryption_key=encryption_key)
    export = ParquetArtifactExport(
        datasets,
        ArtifactPublisher(LocalArtifactStorage(tmp_path / "artifacts"), RecordingMetadataStore()),
    )

    with pytest.raises(ParquetArtifactExportError, match="available tabular Dataset"):
        export(_dataset(datasets), {"fileName": "orders.parquet"})
