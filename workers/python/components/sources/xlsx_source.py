"""XLSX Source implementation backed by safe local workbook access."""

from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath

import polars as pl
from fastexcel import FastExcelError

from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...generated.source_execution_request import SourceExecutionRequest
from ...registries import SourceRegistry
from ...storage import DatasetLifecycle, DatasetStorage

XLSX_SOURCE_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "source",
        "type": "source.xlsx",
        "version": "v1",
        "displayNameKey": "components.sources.xlsx.name",
        "descriptionKey": "components.sources.xlsx.description",
        "configFields": [
            {
                "key": "sourcePath",
                "type": "text",
                "labelKey": "components.sources.xlsx.sourcePath",
                "required": True,
                "secret": False,
            },
            {
                "key": "sheetName",
                "type": "text",
                "labelKey": "components.sources.xlsx.sheetName",
                "required": False,
                "secret": False,
            },
            {
                "key": "hasHeader",
                "type": "boolean",
                "labelKey": "components.sources.xlsx.hasHeader",
                "required": False,
                "secret": False,
            },
        ],
        "inputFamilies": [],
        "outputFamilies": ["tabular"],
    }
)


class XLSXSourceError(RuntimeError):
    """Raised when a workbook cannot be read without exposing cell contents."""


class XLSXSource:
    """Read one configured XLSX worksheet and persist its tabular temporary Dataset."""

    def __init__(
        self,
        storage: DatasetStorage,
        input_root: Path | str,
        *,
        dataset_retention: timedelta = timedelta(days=1),
    ) -> None:
        """Bind storage and the approved local source root for workbook acquisition."""
        if dataset_retention <= timedelta():
            raise ValueError("Dataset retention must be positive.")
        self._storage = storage
        self._input_root = Path(input_root).resolve()
        self._dataset_retention = dataset_retention

    def __call__(self, request: SourceExecutionRequest) -> DatasetDescriptor:
        """Read the requested worksheet and return a persisted tabular Dataset descriptor."""
        path = self._resolve_source_path(request)
        sheet_name = self._configuration_text(request, "sheetName", default=None)
        has_header = self._configuration_bool(request, "hasHeader", default=True)

        try:
            dataset = pl.read_excel(
                path,
                sheet_name=sheet_name,
                engine="calamine",
                has_header=has_header,
            )
        except (FastExcelError, OSError, pl.exceptions.PolarsError, ValueError) as error:
            raise XLSXSourceError("XLSX source could not be read.") from error

        if not isinstance(dataset, pl.DataFrame):
            raise XLSXSourceError("XLSX source must select exactly one worksheet.")

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
        if source_path is None:
            raise XLSXSourceError("XLSX source requires sourcePath configuration.")
        location = PurePosixPath(source_path)
        if location.is_absolute() or ".." in location.parts or location == PurePosixPath("."):
            raise XLSXSourceError("XLSX source path must be a safe relative location.")

        path = (self._input_root / Path(*location.parts)).resolve()
        if not path.is_relative_to(self._input_root) or not path.is_file():
            raise XLSXSourceError("XLSX source file is unavailable.")
        return path

    def _configuration_text(
        self, request: SourceExecutionRequest, key: str, *, default: str | None = None
    ) -> str | None:
        value = request.configuration.values.get(key)
        if value is None:
            return default
        value_root = value.root
        if not isinstance(value_root, str):
            raise XLSXSourceError(f"XLSX {key} configuration must be text.")
        if key == "sheetName" and not value_root.strip():
            raise XLSXSourceError("XLSX sheetName configuration must not be empty.")
        return value_root

    def _configuration_bool(
        self, request: SourceExecutionRequest, key: str, *, default: bool
    ) -> bool:
        value = request.configuration.values.get(key)
        if value is None:
            return default
        value_root = value.root
        if not isinstance(value_root, bool):
            raise XLSXSourceError(f"XLSX {key} configuration must be true or false.")
        return value_root


def register_xlsx_source(registry: SourceRegistry, source: XLSXSource) -> None:
    """Install the XLSX Source capability without coupling it to other Sources."""
    registry.register(XLSX_SOURCE_METADATA, source)
