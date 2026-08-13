"""JSON Source implementation backed by safe local document access."""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import cast

from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...generated.source_execution_request import SourceExecutionRequest
from ...registries import SourceRegistry
from ...storage import DatasetLifecycle, DatasetStorage, JsonDocument

JSON_SOURCE_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "source",
        "type": "source.json",
        "version": "v1",
        "displayNameKey": "components.sources.json.name",
        "descriptionKey": "components.sources.json.description",
        "configFields": [
            {
                "key": "sourcePath",
                "type": "text",
                "labelKey": "components.sources.json.sourcePath",
                "required": True,
                "secret": False,
            },
        ],
        "inputFamilies": [],
        "outputFamilies": ["document"],
    }
)


class JSONSourceError(RuntimeError):
    """Raised when a JSON document cannot be read without exposing its contents."""


class JSONSource:
    """Read a configured JSON document and persist it as a temporary Dataset."""

    def __init__(
        self,
        storage: DatasetStorage,
        input_root: Path | str,
        *,
        dataset_retention: timedelta = timedelta(days=1),
    ) -> None:
        """Bind storage and the approved local source root for document acquisition."""
        if dataset_retention <= timedelta():
            raise ValueError("Dataset retention must be positive.")
        self._storage = storage
        self._input_root = Path(input_root).resolve()
        self._dataset_retention = dataset_retention

    def __call__(self, request: SourceExecutionRequest) -> DatasetDescriptor:
        """Parse the requested JSON file and return its persisted document Dataset descriptor."""
        path = self._resolve_source_path(request)
        try:
            with path.open(encoding="utf-8") as source_file:
                document = cast(JsonDocument, json.load(source_file))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise JSONSourceError("JSON source could not be read.") from error

        return self._storage.persist_document(
            document,
            DatasetLifecycle(
                pipeline_id=request.pipelineId,
                run_id=request.runId,
                step_id=request.stepId,
                expires_at=datetime.now(UTC) + self._dataset_retention,
            ),
        )

    def _resolve_source_path(self, request: SourceExecutionRequest) -> Path:
        value = request.configuration.values.get("sourcePath")
        if value is None:
            raise JSONSourceError("JSON source requires sourcePath configuration.")
        source_path = value.root
        if not isinstance(source_path, str):
            raise JSONSourceError("JSON sourcePath configuration must be text.")

        location = PurePosixPath(source_path)
        if location.is_absolute() or ".." in location.parts or location == PurePosixPath("."):
            raise JSONSourceError("JSON source path must be a safe relative location.")

        path = (self._input_root / Path(*location.parts)).resolve()
        if not path.is_relative_to(self._input_root) or not path.is_file():
            raise JSONSourceError("JSON source file is unavailable.")
        return path


def register_json_source(registry: SourceRegistry, source: JSONSource) -> None:
    """Install the JSON Source capability without coupling it to other Sources."""
    registry.register(JSON_SOURCE_METADATA, source)
