"""Shared safe tabular Dataset handling for focused Transform modules."""

from datetime import UTC, datetime
from typing import Final
from uuid import UUID

import polars as pl

from ...generated.dataset_descriptor import DatasetDescriptor, Family
from ...storage import DatasetLifecycle, DatasetStorage


class TabularTransformError(RuntimeError):
    """Raised when a tabular Transform cannot produce a safe output Dataset."""


_POLARS_ERRORS: Final = (
    pl.exceptions.ColumnNotFoundError,
    pl.exceptions.ComputeError,
    pl.exceptions.DuplicateError,
    pl.exceptions.InvalidOperationError,
    pl.exceptions.SchemaError,
    pl.exceptions.ShapeError,
)


class TabularTransform:
    """Base for Transforms that read and persist tabular temporary Datasets.

    The optional step identifier records ownership of the output Dataset. When
    execution has not provided a distinct identifier yet, the input step is
    retained so the Dataset remains attributable to the active pipeline step.
    """

    def __init__(self, storage: DatasetStorage, *, step_id: UUID | None = None) -> None:
        """Bind the storage adapter and optional output pipeline step identifier."""
        self._storage = storage
        self._step_id = step_id

    def _read(self, dataset: DatasetDescriptor) -> pl.DataFrame:
        """Load only tabular input, failing before an incompatible adapter is used."""
        if dataset.family is not Family.tabular:
            raise TabularTransformError("This transform requires a tabular input dataset.")
        return self._storage.read_tabular(dataset)

    def _persist(self, frame: pl.DataFrame, input_dataset: DatasetDescriptor) -> DatasetDescriptor:
        """Persist a tabular output while preserving its run lifecycle and expiry."""
        if input_dataset.expiresAt <= datetime.now(UTC):
            raise TabularTransformError("The input dataset has expired and cannot be transformed.")
        return self._storage.persist_tabular(
            frame,
            DatasetLifecycle(
                pipeline_id=input_dataset.pipelineId,
                run_id=input_dataset.runId,
                step_id=self._step_id or input_dataset.stepId,
                expires_at=input_dataset.expiresAt,
            ),
        )
