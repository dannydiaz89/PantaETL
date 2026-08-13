"""CSV retained-artifact Export implementation."""

from pathlib import Path

import polars as pl

from ...artifacts import ArtifactLifecycle, ArtifactPublisher
from ...generated.artifact_descriptor import ArtifactDescriptor
from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...registries import ComponentConfiguration, ExportRegistry
from ...storage import DatasetStorage

CSV_ARTIFACT_EXPORT_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "export",
        "type": "export.csv",
        "version": "v1",
        "displayNameKey": "components.exports.csv.name",
        "descriptionKey": "components.exports.csv.description",
        "configFields": [
            {
                "key": "fileName",
                "type": "text",
                "labelKey": "components.exports.csv.fileName",
                "required": True,
                "secret": False,
            }
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": [],
    }
)


class CSVArtifactExportError(RuntimeError):
    """Raised when a tabular Dataset cannot be safely published as CSV."""


class CSVArtifactExport:
    """Publish a tabular Dataset as an atomically finalized CSV artifact."""

    def __init__(self, datasets: DatasetStorage, publisher: ArtifactPublisher) -> None:
        """Bind temporary Dataset storage to retained artifact publication."""
        self._datasets = datasets
        self._publisher = publisher

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> ArtifactDescriptor:
        """Write CSV output with default thirty-day artifact retention metadata."""
        file_name = self._file_name(configuration)
        try:
            frame = self._datasets.read_tabular(dataset)
        except Exception as error:
            raise CSVArtifactExportError(
                "CSV export input is not an available tabular Dataset."
            ) from error

        return self._publisher.publish(
            ArtifactLifecycle.default(dataset.pipelineId, dataset.runId),
            format="csv",
            content_type="text/csv",
            file_name=file_name,
            writer=lambda destination: _write_csv(frame, destination),
        )

    def _file_name(self, configuration: ComponentConfiguration) -> str:
        value = configuration.get("fileName")
        if not isinstance(value, str) or not value:
            raise CSVArtifactExportError("CSV export requires a fileName configuration.")
        return value


def register_csv_artifact_export(registry: ExportRegistry, export: CSVArtifactExport) -> None:
    """Install the CSV artifact Export without coupling it to other Export modules."""
    registry.register(CSV_ARTIFACT_EXPORT_METADATA, export)


def _write_csv(frame: pl.DataFrame, destination: Path) -> None:
    """Write CSV data to the temporary path supplied by the artifact publisher."""
    frame.write_csv(destination)
