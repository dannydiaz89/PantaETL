"""Tests for document-to-tabular flattening without executable user code."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import pytest

from workers.python.components.transforms.document import (
    DocumentFlattenError,
    DocumentFlattenTransform,
    FlattenDocumentConfig,
    register_document_transforms,
)
from workers.python.generated.dataset_descriptor import DatasetDescriptor
from workers.python.registries import TransformRegistry
from workers.python.storage import DatasetLifecycle, JsonDocument, LocalDatasetStorage

PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")
STEP_ID = UUID("00000000-0000-0000-0000-000000000003")


@pytest.fixture
def storage(tmp_path: Path) -> LocalDatasetStorage:
    """Provide isolated local temporary Dataset storage."""
    return LocalDatasetStorage(tmp_path / "datasets")


@pytest.fixture
def document_dataset(storage: LocalDatasetStorage) -> DatasetDescriptor:
    """Persist a nested JSON document with a record array."""
    document: JsonDocument = {
        "orders": [
            {
                "id": 1,
                "customer": {"name": "Ada"},
                "tags": ["priority", "online"],
                "lines": [{"sku": "A"}, {"sku": "B"}],
            }
        ]
    }
    return storage.persist_document(
        document,
        DatasetLifecycle(
            pipeline_id=PIPELINE_ID,
            run_id=RUN_ID,
            step_id=STEP_ID,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        ),
    )


def test_document_flatten_outputs_tabular_data_and_supports_declared_array_modes(
    storage: LocalDatasetStorage, document_dataset: DatasetDescriptor
) -> None:
    """Nested objects flatten to columns and arrays can remain JSON or expand to rows."""
    transform = DocumentFlattenTransform(storage)
    compact = transform(document_dataset, {"record_path": ["orders"], "array_mode": "json"})
    expanded = transform(document_dataset, {"record_path": ["orders"], "array_mode": "explode"})

    assert compact.family.value == "tabular"
    assert storage.read_tabular(compact).to_dicts() == [
        {
            "id": 1,
            "customer.name": "Ada",
            "tags": '["priority","online"]',
            "lines": '[{"sku":"A"},{"sku":"B"}]',
        }
    ]
    assert storage.read_tabular(expanded).to_dicts() == [
        {"id": 1, "customer.name": "Ada", "tags": "priority", "lines.sku": "A"},
        {"id": 1, "customer.name": "Ada", "tags": "priority", "lines.sku": "B"},
        {"id": 1, "customer.name": "Ada", "tags": "online", "lines.sku": "A"},
        {"id": 1, "customer.name": "Ada", "tags": "online", "lines.sku": "B"},
    ]


def test_document_flatten_rejects_unsupported_shapes_with_safe_errors(
    storage: LocalDatasetStorage, document_dataset: DatasetDescriptor
) -> None:
    """Nested arrays and invalid paths fail without returning source record content."""
    transform = DocumentFlattenTransform(storage)
    with pytest.raises(DocumentFlattenError, match="path is unavailable") as missing_path:
        transform(document_dataset, {"record_path": ["missing"]})
    with pytest.raises(DocumentFlattenError, match="Nested arrays") as nested_arrays:
        source = storage.persist_document(
            {"rows": [{"values": [["private"]]}]},
            DatasetLifecycle(
                pipeline_id=PIPELINE_ID,
                run_id=RUN_ID,
                step_id=STEP_ID,
                expires_at=datetime.now(UTC) + timedelta(hours=1),
            ),
        )
        transform(source, {"record_path": ["rows"], "array_mode": "explode"})

    assert "private" not in str(nested_arrays.value)
    assert "orders" not in str(missing_path.value)


def test_document_flatten_configuration_and_registry_are_explicit(
    storage: LocalDatasetStorage,
) -> None:
    """Config defaults remain documented and the focused capability registers once."""
    assert FlattenDocumentConfig.model_validate({}).array_mode == "json"
    registry = TransformRegistry()
    register_document_transforms(registry, storage)

    assert [metadata.type for metadata in registry.metadata()] == ["transform.document.flatten"]
