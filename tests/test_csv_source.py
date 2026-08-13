"""Tests for safe CSV acquisition and Dataset persistence."""

from pathlib import Path
from uuid import UUID

import pytest

from workers.python.components.sources.csv_source import CSVSource, CSVSourceError
from workers.python.generated.source_execution_request import SourceExecutionRequest
from workers.python.storage import LocalDatasetStorage

PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")
STEP_ID = UUID("00000000-0000-0000-0000-000000000003")


def source_request(values: dict[str, object]) -> SourceExecutionRequest:
    """Build a valid CSV Source request with portable configuration values."""
    return SourceExecutionRequest.model_validate(
        {
            "contractVersion": "v1",
            "jobId": "00000000-0000-0000-0000-000000000004",
            "pipelineId": str(PIPELINE_ID),
            "runId": str(RUN_ID),
            "stepId": str(STEP_ID),
            "componentId": "00000000-0000-0000-0000-000000000005",
            "componentType": "source.csv",
            "componentVersion": "v1",
            "configuration": {"values": values, "secretBindings": []},
        }
    )


def test_csv_source_reads_only_safe_relative_files_and_persists_tabular_data(
    tmp_path: Path,
) -> None:
    """A CSV Source produces the canonical temporary tabular Dataset format."""
    inputs = tmp_path / "inputs"
    inputs.mkdir()
    (inputs / "orders.csv").write_text("order_id,total\n1,12.50\n2,9.00\n", encoding="utf-8")
    storage = LocalDatasetStorage(tmp_path / "datasets")

    descriptor = CSVSource(storage, inputs)(source_request({"sourcePath": "orders.csv"}))

    assert descriptor.family.value == "tabular"
    assert descriptor.pipelineId == PIPELINE_ID
    assert descriptor.runId == RUN_ID
    assert storage.read_tabular(descriptor).to_dicts() == [
        {"order_id": 1, "total": 12.5},
        {"order_id": 2, "total": 9.0},
    ]


def test_csv_source_rejects_unsafe_paths_and_safe_errors_omit_record_contents(
    tmp_path: Path,
) -> None:
    """Invalid source input fails without echoing file contents into an error."""
    source = CSVSource(LocalDatasetStorage(tmp_path / "datasets"), tmp_path)

    with pytest.raises(CSVSourceError, match="safe relative") as error:
        source(source_request({"sourcePath": "../sensitive.csv"}))

    assert "record" not in str(error.value).lower()


def test_csv_source_validates_delimiter_without_reading_records(tmp_path: Path) -> None:
    """Configuration errors are detected before parsing the source file."""
    (tmp_path / "orders.csv").write_text("id\n1\n", encoding="utf-8")
    source = CSVSource(LocalDatasetStorage(tmp_path / "datasets"), tmp_path)

    with pytest.raises(CSVSourceError, match="exactly one character"):
        source(source_request({"sourcePath": "orders.csv", "separator": "::"}))
