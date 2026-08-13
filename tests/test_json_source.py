"""Tests for safe JSON acquisition and document Dataset persistence."""

from pathlib import Path
from uuid import UUID

import pytest

from workers.python.components.sources.json_source import JSONSource, JSONSourceError
from workers.python.generated.source_execution_request import SourceExecutionRequest
from workers.python.storage import LocalDatasetStorage

PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")
STEP_ID = UUID("00000000-0000-0000-0000-000000000003")


def source_request(values: dict[str, object]) -> SourceExecutionRequest:
    """Build a valid JSON Source request with portable configuration values."""
    return SourceExecutionRequest.model_validate(
        {
            "contractVersion": "v1",
            "jobId": "00000000-0000-0000-0000-000000000004",
            "pipelineId": str(PIPELINE_ID),
            "runId": str(RUN_ID),
            "stepId": str(STEP_ID),
            "componentId": "00000000-0000-0000-0000-000000000005",
            "componentType": "source.json",
            "componentVersion": "v1",
            "configuration": {"values": values, "secretBindings": []},
        }
    )


def test_json_source_persists_a_document_dataset(tmp_path: Path) -> None:
    """A JSON Source preserves nested document data in a temporary Dataset."""
    inputs = tmp_path / "inputs"
    inputs.mkdir()
    document = '{"orders":[{"id":1,"total":12.5}],"source":"fixture"}'
    (inputs / "orders.json").write_text(document, encoding="utf-8")
    storage = LocalDatasetStorage(tmp_path / "datasets")

    descriptor = JSONSource(storage, inputs)(source_request({"sourcePath": "orders.json"}))

    assert descriptor.family.value == "document"
    assert descriptor.format == "json"
    assert descriptor.pipelineId == PIPELINE_ID
    assert descriptor.runId == RUN_ID
    assert storage.read_document(descriptor) == {
        "orders": [{"id": 1, "total": 12.5}],
        "source": "fixture",
    }


def test_json_source_rejects_unsafe_paths_and_safe_errors_omit_document_contents(
    tmp_path: Path,
) -> None:
    """Invalid paths and malformed JSON do not echo document content into errors."""
    (tmp_path / "broken.json").write_text('{"private":"never reveal"', encoding="utf-8")
    source = JSONSource(LocalDatasetStorage(tmp_path / "datasets"), tmp_path)

    with pytest.raises(JSONSourceError, match="safe relative"):
        source(source_request({"sourcePath": "../sensitive.json"}))
    with pytest.raises(JSONSourceError, match="could not be read") as error:
        source(source_request({"sourcePath": "broken.json"}))

    assert "never reveal" not in str(error.value)
