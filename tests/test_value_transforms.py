"""Tests for safe credential-free value and type Transform implementations."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import polars as pl
import pytest

from workers.python.components.transforms.values import (
    CastColumnTransform,
    FillNullTransform,
    NormalizeStringTransform,
    ReplaceValuesTransform,
    ValueTransformError,
    register_value_transforms,
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
    """Persist a tabular Dataset with nulls and unnormalized string values."""
    return storage.persist_tabular(
        pl.DataFrame({"raw_id": ["1", "2"], "status": ["old", None], "name": ["  ADA  ", "Lin"]}),
        DatasetLifecycle(
            pipeline_id=PIPELINE_ID,
            run_id=RUN_ID,
            step_id=STEP_ID,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        ),
    )


def test_value_transforms_cast_replace_fill_and_normalize(
    storage: LocalDatasetStorage, input_dataset: DatasetDescriptor
) -> None:
    """Value transforms produce the requested portable tabular values."""
    cast = CastColumnTransform(storage)(input_dataset, {"column": "raw_id", "data_type": "integer"})
    replaced = ReplaceValuesTransform(storage)(
        cast, {"column": "status", "replacements": {"old": "active"}}
    )
    filled = FillNullTransform(storage)(replaced, {"column": "status", "value": "unknown"})
    normalized = NormalizeStringTransform(storage)(
        filled, {"column": "name", "operation": "lowercase"}
    )

    assert storage.read_tabular(normalized).to_dicts() == [
        {"raw_id": 1, "status": "active", "name": "  ada  "},
        {"raw_id": 2, "status": "unknown", "name": "lin"},
    ]


def test_value_transforms_fail_without_record_content(
    storage: LocalDatasetStorage, input_dataset: DatasetDescriptor
) -> None:
    """Invalid configured columns fail with safe operational context."""
    with pytest.raises(ValueTransformError, match="invalid") as error:
        FillNullTransform(storage)(input_dataset, {"column": "missing", "value": "Ada"})

    assert "Ada" not in str(error.value)


def test_value_transforms_register_individually(storage: LocalDatasetStorage) -> None:
    """The Transform registry exposes each focused value/type capability."""
    registry = TransformRegistry()
    register_value_transforms(registry, storage)

    assert [metadata.type for metadata in registry.metadata()] == [
        "transform.values.cast",
        "transform.values.replace",
        "transform.values.fill-null",
        "transform.values.normalize-string",
    ]
