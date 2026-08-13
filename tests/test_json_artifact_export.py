"""Tests for JSON artifact publication and retained metadata recording."""

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import polars as pl
import pytest

from workers.python.artifacts import ArtifactPublisher, LocalArtifactStorage
from workers.python.components.exports.json_artifact import (
    JSONArtifactExport,
    JSONArtifactExportError,
)
from workers.python.generated.artifact_descriptor import ArtifactDescriptor
from workers.python.generated.dataset_descriptor import DatasetDescriptor
from workers.python.storage import DatasetLifecycle, LocalDatasetStorage

PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")
STEP_ID = UUID("00000000-0000-0000-0000-000000000003")


class RecordingMetadataStore:
    """In-memory metadata recorder used to prove JSON output is durably described."""

    def __init__(self) -> None:
        """Create a recorder with no finalized artifact records."""
        self.descriptors: list[ArtifactDescriptor] = []

    def record(self, descriptor: ArtifactDescriptor) -> None:
        """Record the finalized artifact descriptor after its file exists."""
        self.descriptors.append(descriptor)


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


def test_json_export_finalizes_output_and_records_artifact_metadata(tmp_path: Path) -> None:
    """JSON output receives durable file metadata only after atomic finalization."""
    datasets = LocalDatasetStorage(tmp_path / "datasets")
    metadata = RecordingMetadataStore()
    export = JSONArtifactExport(
        datasets,
        ArtifactPublisher(LocalArtifactStorage(tmp_path / "artifacts"), metadata),
    )

    descriptor = export(_dataset(datasets), {"fileName": "orders.json"})

    artifact_path = tmp_path / "artifacts" / descriptor.storage.location
    assert json.loads(artifact_path.read_text(encoding="utf-8")) == [
        {"order_id": 1, "total": 12.5},
        {"order_id": 2, "total": 9.0},
    ]
    assert metadata.descriptors == [descriptor]
    assert descriptor.format == "json"
    assert descriptor.contentType == "application/json"
    assert descriptor.retention.retentionDays == 30


def test_json_export_rejects_missing_file_name_without_writing(tmp_path: Path) -> None:
    """Missing output configuration fails before output storage can be touched."""
    datasets = LocalDatasetStorage(tmp_path / "datasets")
    export = JSONArtifactExport(
        datasets,
        ArtifactPublisher(LocalArtifactStorage(tmp_path / "artifacts"), RecordingMetadataStore()),
    )

    with pytest.raises(JSONArtifactExportError, match="fileName"):
        export(_dataset(datasets), {})
    assert not (tmp_path / "artifacts").exists()
