"""Tests for safe credential-free column Transform implementations."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import polars as pl
import pytest
from pydantic import ValidationError

from workers.python.components.transforms.columns import (
    ColumnTransformError,
    DropColumnsTransform,
    RenameColumnsTransform,
    ReorderColumnsTransform,
    SelectColumnsConfig,
    SelectColumnsTransform,
    register_column_transforms,
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
    """Persist a representative tabular input Dataset."""
    return storage.persist_tabular(
        pl.DataFrame({"id": [1, 2], "name": ["Ada", "Lin"], "total": [12.5, 9.0]}),
        DatasetLifecycle(
            pipeline_id=PIPELINE_ID,
            run_id=RUN_ID,
            step_id=STEP_ID,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        ),
    )


def test_column_transforms_select_rename_drop_and_reorder(
    storage: LocalDatasetStorage, input_dataset: DatasetDescriptor
) -> None:
    """Column transforms retain a safe tabular Dataset lifecycle and expected data."""
    dataset = input_dataset
    selected = SelectColumnsTransform(storage)(dataset, {"columns": ["name", "id"]})
    renamed = RenameColumnsTransform(storage)(selected, {"renames": {"name": "customer"}})
    dropped = DropColumnsTransform(storage)(renamed, {"columns": ["id"]})
    reordered = ReorderColumnsTransform(storage)(dropped, {"columns": ["customer"]})

    assert storage.read_tabular(reordered).to_dicts() == [{"customer": "Ada"}, {"customer": "Lin"}]
    assert reordered.pipelineId == PIPELINE_ID
    assert reordered.runId == RUN_ID
    assert reordered.expiresAt == dataset.expiresAt


def test_column_transforms_reject_invalid_columns_without_exposing_data(
    storage: LocalDatasetStorage, input_dataset: DatasetDescriptor
) -> None:
    """Invalid column references fail with safe context rather than record contents."""
    with pytest.raises(ColumnTransformError, match="unavailable") as error:
        SelectColumnsTransform(storage)(input_dataset, {"columns": ["secret"]})

    assert "Ada" not in str(error.value)


def test_column_config_models_reject_ambiguous_arrangements() -> None:
    """Configuration models reject repeated column names before execution."""
    with pytest.raises(ValidationError, match="unique"):
        SelectColumnsConfig.model_validate({"columns": ["id", "id"]})


def test_column_transforms_register_individually(storage: LocalDatasetStorage) -> None:
    """The Transform registry exposes every focused column capability."""
    registry = TransformRegistry()
    register_column_transforms(registry, storage)

    assert [metadata.type for metadata in registry.metadata()] == [
        "transform.columns.select",
        "transform.columns.rename",
        "transform.columns.drop",
        "transform.columns.reorder",
    ]
