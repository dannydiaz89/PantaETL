"""CSV Source implementation backed by safe local file access."""

from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath

import polars as pl

from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...generated.source_execution_request import SourceExecutionRequest
from ...registries import SourceRegistry
from ...storage import DatasetLifecycle, DatasetStorage

CSV_SOURCE_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "source",
        "type": "source.csv",
        "version": "v1",
        "displayNameKey": "components.sources.csv.name",
        "descriptionKey": "components.sources.csv.description",
        "configFields": [
            {
                "key": "sourcePath",
                "type": "file",
                "labelKey": "components.sources.csv.sourcePath",
                "descriptionKey": "components.sources.csv.sourcePathDescription",
                "required": True,
                "secret": False,
                "width": "full",
            },
            {
                "key": "hasHeader",
                "type": "boolean",
                "labelKey": "components.sources.csv.hasHeader",
                "descriptionKey": "components.sources.csv.hasHeaderDescription",
                "required": False,
                "secret": False,
                "defaultValue": True,
                "width": "full",
            },
            {
                "key": "separator",
                "type": "text",
                "labelKey": "components.sources.csv.separator",
                "descriptionKey": "components.sources.csv.separatorDescription",
                "required": False,
                "secret": False,
                "defaultValue": ",",
                "width": "short",
            },
        ],
        "inputFamilies": [],
        "outputFamilies": ["tabular"],
    }
)


class CSVSourceError(RuntimeError):
    """Raised when a CSV file cannot be read without exposing record contents."""


class CSVSource:
    """Read a configured CSV file and persist its tabular temporary Dataset."""

    def __init__(
        self,
        storage: DatasetStorage,
        input_root: Path | str,
        *,
        dataset_retention: timedelta = timedelta(days=1),
    ) -> None:
        """Bind storage and the approved local source root for CSV acquisition."""
        if dataset_retention <= timedelta():
            raise ValueError("Dataset retention must be positive.")
        self._storage = storage
        self._input_root = Path(input_root).resolve()
        self._dataset_retention = dataset_retention

    def __call__(self, request: SourceExecutionRequest) -> DatasetDescriptor:
        """Parse the requested CSV and return a persisted tabular Dataset descriptor."""
        path = self._resolve_source_path(request)
        has_header = self._configuration_bool(request, "hasHeader", default=True)
        separator = self._configuration_text(request, "separator", default=",")
        if len(separator) != 1:
            raise CSVSourceError("CSV separator must be exactly one character.")

        try:
            dataset = pl.read_csv(path, has_header=has_header, separator=separator)
        except (OSError, pl.exceptions.PolarsError) as error:
            raise CSVSourceError(f"CSV source could not be read: {path.name}.") from error

        return self._storage.persist_tabular(
            dataset,
            DatasetLifecycle(
                pipeline_id=request.pipelineId,
                run_id=request.runId,
                step_id=request.stepId,
                expires_at=datetime.now(UTC) + self._dataset_retention,
            ),
        )

    def _resolve_source_path(self, request: SourceExecutionRequest) -> Path:
        source_path = self._configuration_text(request, "sourcePath")
        location = PurePosixPath(source_path)
        if location.is_absolute() or ".." in location.parts or location == PurePosixPath("."):
            raise CSVSourceError("CSV source path must be a safe relative location.")

        path = (self._input_root / Path(*location.parts)).resolve()
        if not path.is_relative_to(self._input_root) or not path.is_file():
            raise CSVSourceError("CSV source file is unavailable.")
        return path

    def _configuration_text(
        self, request: SourceExecutionRequest, key: str, *, default: str | None = None
    ) -> str:
        value = request.configuration.values.get(key)
        if value is None:
            if default is None:
                raise CSVSourceError(f"CSV source requires {key} configuration.")
            return default
        value_root = value.root
        if not isinstance(value_root, str):
            raise CSVSourceError(f"CSV {key} configuration must be text.")
        return value_root

    def _configuration_bool(
        self, request: SourceExecutionRequest, key: str, *, default: bool
    ) -> bool:
        value = request.configuration.values.get(key)
        if value is None:
            return default
        value_root = value.root
        if not isinstance(value_root, bool):
            raise CSVSourceError(f"CSV {key} configuration must be true or false.")
        return value_root


def register_csv_source(registry: SourceRegistry, source: CSVSource) -> None:
    """Install the CSV Source capability without coupling it to other Sources."""
    registry.register(CSV_SOURCE_METADATA, source)
