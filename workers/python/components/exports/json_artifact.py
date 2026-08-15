"""JSON retained-artifact Export implementation."""

from pathlib import Path

import polars as pl

from ...artifacts import ArtifactLifecycle, ArtifactPublisher
from ...generated.artifact_descriptor import ArtifactDescriptor
from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...registries import ComponentConfiguration, ExportRegistry
from ...storage import DatasetStorage

JSON_ARTIFACT_EXPORT_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "export",
        "type": "export.json",
        "version": "v1",
        "displayNameKey": "components.exports.json.name",
        "descriptionKey": "components.exports.json.description",
        "configFields": [
            {
                "key": "fileName",
                "type": "text",
                "labelKey": "components.exports.json.fileName",
                "descriptionKey": "components.exports.json.fileNameDescription",
                "placeholderKey": "components.exports.json.fileNameExample",
                "required": True,
                "secret": False,
            }
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": [],
    }
)


class JSONArtifactExportError(RuntimeError):
    """Raised when a tabular Dataset cannot be safely published as JSON."""


class JSONArtifactExport:
    """Publish a tabular Dataset as an atomically finalized JSON artifact."""

    def __init__(self, datasets: DatasetStorage, publisher: ArtifactPublisher) -> None:
        """Bind temporary Dataset storage to retained artifact publication."""
        self._datasets = datasets
        self._publisher = publisher

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> ArtifactDescriptor:
        """Write JSON output and record its explicit retained-artifact metadata."""
        file_name = self._file_name(configuration)
        try:
            frame = self._datasets.read_tabular(dataset)
        except Exception as error:
            raise JSONArtifactExportError(
                "JSON export input is not an available tabular Dataset."
            ) from error

        return self._publisher.publish(
            ArtifactLifecycle.default(dataset.pipelineId, dataset.runId),
            format="json",
            content_type="application/json",
            file_name=file_name,
            writer=lambda destination: _write_json(frame, destination),
        )

    def _file_name(self, configuration: ComponentConfiguration) -> str:
        value = configuration.get("fileName")
        if not isinstance(value, str) or not value:
            raise JSONArtifactExportError("JSON export requires a fileName configuration.")
        return value


def register_json_artifact_export(registry: ExportRegistry, export: JSONArtifactExport) -> None:
    """Install the JSON artifact Export without coupling it to other Export modules."""
    registry.register(JSON_ARTIFACT_EXPORT_METADATA, export)


def _write_json(frame: pl.DataFrame, destination: Path) -> None:
    """Write JSON data to the temporary path supplied by the artifact publisher."""
    frame.write_json(destination)
