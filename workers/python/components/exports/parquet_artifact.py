"""Parquet retained-artifact Export implementation with lazy streaming output."""

from pathlib import Path
from typing import Protocol

import polars as pl

from ...artifacts import ArtifactLifecycle, ArtifactPublisher
from ...generated.artifact_descriptor import ArtifactDescriptor
from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...registries import ComponentConfiguration, ExportRegistry

PARQUET_ARTIFACT_EXPORT_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "export",
        "type": "export.parquet",
        "version": "v1",
        "displayNameKey": "components.exports.parquet.name",
        "descriptionKey": "components.exports.parquet.description",
        "configFields": [
            {
                "key": "fileName",
                "type": "text",
                "labelKey": "components.exports.parquet.fileName",
                "required": True,
                "secret": False,
            }
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": [],
    }
)


class ParquetArtifactExportError(RuntimeError):
    """Raised when a tabular Dataset cannot be safely published as Parquet."""


class LazyTabularDatasetStorage(Protocol):
    """Dataset read boundary that can preserve lazy scanning through an Export sink."""

    def scan_tabular(self, descriptor: DatasetDescriptor) -> pl.LazyFrame:
        """Open a tabular Dataset as a lazy frame without collecting all rows."""


class ParquetArtifactExport:
    """Publish a lazy tabular Dataset as an atomically finalized Parquet artifact."""

    def __init__(self, datasets: LazyTabularDatasetStorage, publisher: ArtifactPublisher) -> None:
        """Bind lazy Dataset scanning to retained artifact publication."""
        self._datasets = datasets
        self._publisher = publisher

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> ArtifactDescriptor:
        """Stream Parquet output to a temporary file before atomically finalizing it."""
        file_name = self._file_name(configuration)
        try:
            lazy_frame = self._datasets.scan_tabular(dataset)
        except Exception as error:
            raise ParquetArtifactExportError(
                "Parquet export input is not an available tabular Dataset."
            ) from error

        return self._publisher.publish(
            ArtifactLifecycle.default(dataset.pipelineId, dataset.runId),
            format="parquet",
            content_type="application/vnd.apache.parquet",
            file_name=file_name,
            writer=lambda destination: _sink_parquet(lazy_frame, destination),
        )

    def _file_name(self, configuration: ComponentConfiguration) -> str:
        value = configuration.get("fileName")
        if not isinstance(value, str) or not value:
            raise ParquetArtifactExportError("Parquet export requires a fileName configuration.")
        return value


def register_parquet_artifact_export(
    registry: ExportRegistry, export: ParquetArtifactExport
) -> None:
    """Install the Parquet artifact Export without coupling it to other Export modules."""
    registry.register(PARQUET_ARTIFACT_EXPORT_METADATA, export)


def _sink_parquet(lazy_frame: pl.LazyFrame, destination: Path) -> None:
    """Stream a lazy query plan to the publisher's temporary Parquet file."""
    lazy_frame.sink_parquet(destination)
