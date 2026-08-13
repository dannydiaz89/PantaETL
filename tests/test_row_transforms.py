"""Tests for safe declarative row Transform implementations."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import polars as pl
import pytest
from pydantic import ValidationError

from workers.python.components.transforms.rows import (
    FULL_DATASET_CHARACTERISTICS,
    DeduplicateRowsTransform,
    FilterRowsConfig,
    FilterRowsTransform,
    LimitRowsTransform,
    SortRowsTransform,
    register_row_transforms,
)
from workers.python.generated.dataset_descriptor import DatasetDescriptor
from workers.python.registries import TransformRegistry
from workers.python.storage import DatasetLifecycle, LocalDatasetStorage

PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")
STEP_ID = UUID("00000000-0000-0000-0000-000000000003")


@pytest.fixture
def storage(tmp_path: Path) -> LocalDatasetStorage:
    """Provide isolated local temporary Dataset storage."""
    return LocalDatasetStorage(tmp_path / "datasets")


@pytest.fixture
def input_dataset(storage: LocalDatasetStorage) -> DatasetDescriptor:
    """Persist a tabular Dataset with rows useful for all row operations."""
    return storage.persist_tabular(
        pl.DataFrame(
            {
                "id": [2, 1, 2, 3],
                "priority": [None, 2, None, 1],
                "name": ["Ada", "Lin", "Ada", "Kai"],
            }
        ),
        DatasetLifecycle(
            pipeline_id=PIPELINE_ID,
            run_id=RUN_ID,
            step_id=STEP_ID,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        ),
    )


def test_row_transforms_filter_deduplicate_sort_and_limit(
    storage: LocalDatasetStorage, input_dataset: DatasetDescriptor
) -> None:
    """Declarative row operations produce expected data without executable user code."""
    filtered = FilterRowsTransform(storage)(
        input_dataset, {"column": "priority", "operator": "isNull"}
    )
    deduplicated = DeduplicateRowsTransform(storage)(filtered, {"columns": ["id"], "keep": "first"})
    sorted_rows = SortRowsTransform(storage)(
        deduplicated, {"columns": [{"column": "id", "descending": True}]}
    )
    limited = LimitRowsTransform(storage)(sorted_rows, {"count": 1})

    assert storage.read_tabular(limited).to_dicts() == [{"id": 2, "priority": None, "name": "Ada"}]


def test_filter_config_rejects_invalid_predicates_and_row_operations_declare_costs() -> None:
    """Filters avoid ambiguous values and full-Dataset operations declare their behavior."""
    with pytest.raises(ValidationError, match="Comparison filters require"):
        FilterRowsConfig.model_validate({"column": "id", "operator": "equals"})
    with pytest.raises(ValidationError, match="do not accept"):
        FilterRowsConfig.model_validate({"column": "id", "operator": "isNull", "value": 1})

    assert DeduplicateRowsTransform.execution_characteristics == FULL_DATASET_CHARACTERISTICS
    assert SortRowsTransform.execution_characteristics == FULL_DATASET_CHARACTERISTICS


def test_row_transforms_register_individually(storage: LocalDatasetStorage) -> None:
    """The Transform registry exposes every focused row capability."""
    registry = TransformRegistry()
    register_row_transforms(registry, storage)

    assert [metadata.type for metadata in registry.metadata()] == [
        "transform.rows.filter",
        "transform.rows.deduplicate",
        "transform.rows.sort",
        "transform.rows.limit",
    ]
