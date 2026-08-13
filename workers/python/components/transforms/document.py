"""Document-to-tabular Transform implementation."""

import json
from collections.abc import Mapping
from itertools import product
from typing import Annotated, Literal

import polars as pl
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor, Family
from ...registries import ComponentConfiguration, TransformRegistry
from ...storage import DatasetStorage, JsonDocument
from ._tabular import _POLARS_ERRORS, TabularTransform, TabularTransformError


class DocumentFlattenError(TabularTransformError):
    """Raised when a document cannot be converted into an unambiguous table."""


ScalarValue = str | int | float | bool | None
FlatRecord = dict[str, ScalarValue]


class FlattenDocumentConfig(BaseModel):
    """Configuration selecting document records and deterministic array handling.

    ``record_path`` selects an optional nested list or object containing records.
    Nested objects become delimiter-separated columns. ``array_mode`` either
    retains arrays as compact JSON text or emits the Cartesian expansion of
    arrays within each record.
    """

    model_config = ConfigDict(extra="forbid")

    record_path: list[Annotated[str, Field(min_length=1)]] = []
    array_mode: Literal["json", "explode"] = "json"
    separator: Annotated[str, Field(min_length=1, max_length=8)] = "."

    @field_validator("record_path")
    @classmethod
    def reject_repeated_path_segments(cls, value: list[str]) -> list[str]:
        """Require a direct record path rather than an ambiguous cyclic-looking path."""
        if any(not segment.strip() for segment in value):
            raise ValueError("Record path segments must not be blank.")
        return value


DOCUMENT_FLATTEN_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.document.flatten",
        "version": "v1",
        "displayNameKey": "components.transforms.document.flatten.name",
        "descriptionKey": "components.transforms.document.flatten.description",
        "configFields": [
            {
                "key": "record_path",
                "type": "json",
                "labelKey": "components.transforms.document.flatten.recordPath",
                "required": False,
                "secret": False,
            },
            {
                "key": "array_mode",
                "type": "select",
                "labelKey": "components.transforms.document.flatten.arrayMode",
                "required": False,
                "secret": False,
                "options": [
                    {
                        "value": value,
                        "labelKey": f"components.transforms.document.flatten.arrayMode.{value}",
                    }
                    for value in ("json", "explode")
                ],
            },
            {
                "key": "separator",
                "type": "text",
                "labelKey": "components.transforms.document.flatten.separator",
                "required": False,
                "secret": False,
            },
        ],
        "inputFamilies": ["document"],
        "outputFamilies": ["tabular"],
    }
)


class DocumentFlattenTransform(TabularTransform):
    """Convert a JSON document Dataset into a temporary tabular Dataset."""

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Flatten document records according to config and persist tabular output."""
        config = FlattenDocumentConfig.model_validate(configuration)
        if dataset.family is not Family.document:
            raise DocumentFlattenError("Document flatten requires a document input dataset.")
        document = self._storage.read_document(dataset)
        try:
            records = _flatten_document(document, config)
            output = pl.DataFrame(records)
        except _POLARS_ERRORS as error:
            raise DocumentFlattenError(
                "Document values cannot be represented as a table."
            ) from error
        return self._persist(output, dataset)


def register_document_transforms(registry: TransformRegistry, storage: DatasetStorage) -> None:
    """Install the focused document-to-tabular Transform capability."""
    registry.register(DOCUMENT_FLATTEN_METADATA, DocumentFlattenTransform(storage))


def _flatten_document(document: JsonDocument, config: FlattenDocumentConfig) -> list[FlatRecord]:
    """Find configured records and flatten every object into zero or more table rows."""
    target = _resolve_record_path(document, config.record_path)
    records: list[dict[str, JsonDocument]]
    if isinstance(target, dict):
        records = [target]
    elif isinstance(target, list):
        records = []
        for item in target:
            if not isinstance(item, dict):
                raise DocumentFlattenError("Document record arrays must contain objects.")
            records.append(item)
    else:
        raise DocumentFlattenError(
            "Document record path must resolve to an object or array of objects."
        )

    flattened: list[FlatRecord] = []
    for record in records:
        flattened.extend(_flatten_object(record, prefix="", config=config))
    return flattened


def _resolve_record_path(document: JsonDocument, record_path: list[str]) -> JsonDocument:
    """Resolve an object-only path without allowing implicit array traversal."""
    current = document
    for segment in record_path:
        if not isinstance(current, dict) or segment not in current:
            raise DocumentFlattenError("Configured record path is unavailable in the document.")
        current = current[segment]
    return current


def _flatten_object(
    values: Mapping[str, JsonDocument], *, prefix: str, config: FlattenDocumentConfig
) -> list[FlatRecord]:
    """Flatten one object, combining nested arrays with explicit Cartesian semantics."""
    fragments: list[list[FlatRecord]] = []
    for key, value in values.items():
        if not key:
            raise DocumentFlattenError("Document object keys must not be empty.")
        column = f"{prefix}{config.separator}{key}" if prefix else key
        fragments.append(_flatten_value(value, column=column, config=config))

    rows: list[FlatRecord] = [{}]
    for alternatives in fragments:
        if not alternatives:
            return []
        rows = [_merge_records(left, right) for left, right in product(rows, alternatives)]
    return rows


def _flatten_value(
    value: JsonDocument, *, column: str, config: FlattenDocumentConfig
) -> list[FlatRecord]:
    """Flatten a nested object or apply the configured array representation."""
    if isinstance(value, dict):
        return _flatten_object(value, prefix=column, config=config)
    if isinstance(value, list):
        if config.array_mode == "json":
            return [{column: json.dumps(value, ensure_ascii=False, separators=(",", ":"))}]
        return _explode_array(value, column=column, config=config)
    return [{column: value}]


def _explode_array(
    values: list[JsonDocument], *, column: str, config: FlattenDocumentConfig
) -> list[FlatRecord]:
    """Expand a flat array, rejecting nested arrays with no clear table representation."""
    rows: list[FlatRecord] = []
    for value in values:
        if isinstance(value, list):
            raise DocumentFlattenError("Nested arrays are unsupported when array mode is explode.")
        if isinstance(value, dict):
            rows.extend(_flatten_object(value, prefix=column, config=config))
        else:
            rows.append({column: value})
    return rows


def _merge_records(left: FlatRecord, right: FlatRecord) -> FlatRecord:
    """Combine independent flattened branches without silently overwriting columns."""
    conflicts = set(left).intersection(right)
    if conflicts:
        raise DocumentFlattenError("Document flattening produced conflicting output column names.")
    return {**left, **right}
