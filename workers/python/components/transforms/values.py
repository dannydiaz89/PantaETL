"""Value and type tabular Transform implementations."""

from typing import Annotated, Final, Literal

import polars as pl
from pydantic import BaseModel, ConfigDict, Field

from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...registries import ComponentConfiguration, TransformRegistry
from ...storage import DatasetStorage
from ._tabular import _POLARS_ERRORS, TabularTransform, TabularTransformError


class ValueTransformError(TabularTransformError):
    """Raised when configured value or type operations cannot safely execute."""


ScalarValue = str | int | float | bool


class CastColumnConfig(BaseModel):
    """Configuration casting one column to a supported portable scalar type."""

    model_config = ConfigDict(extra="forbid")

    column: Annotated[str, Field(min_length=1)]
    data_type: Literal["text", "integer", "float", "boolean", "date", "datetime"]
    strict: bool = True


class ReplaceValuesConfig(BaseModel):
    """Configuration replacing scalar column values with scalar JSON-compatible values."""

    model_config = ConfigDict(extra="forbid")

    column: Annotated[str, Field(min_length=1)]
    replacements: Annotated[dict[str, ScalarValue], Field(min_length=1)]


class FillNullConfig(BaseModel):
    """Configuration replacing null values in one column with a scalar value."""

    model_config = ConfigDict(extra="forbid")

    column: Annotated[str, Field(min_length=1)]
    value: ScalarValue


class NormalizeStringConfig(BaseModel):
    """Configuration applying one deterministic normalization to text column values."""

    model_config = ConfigDict(extra="forbid")

    column: Annotated[str, Field(min_length=1)]
    operation: Literal["trim", "lowercase", "uppercase", "normalizeWhitespace"]


CAST_COLUMN_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.values.cast",
        "version": "v1",
        "displayNameKey": "components.transforms.values.cast.name",
        "descriptionKey": "components.transforms.values.cast.description",
        "configFields": [
            {
                "key": "column",
                "type": "text",
                "labelKey": "components.transforms.values.cast.column",
                "required": True,
                "secret": False,
            },
            {
                "key": "data_type",
                "type": "select",
                "labelKey": "components.transforms.values.cast.dataType",
                "required": True,
                "secret": False,
                "options": [
                    {
                        "value": value,
                        "labelKey": f"components.transforms.values.cast.dataType.{value}",
                    }
                    for value in ("text", "integer", "float", "boolean", "date", "datetime")
                ],
            },
            {
                "key": "strict",
                "type": "boolean",
                "labelKey": "components.transforms.values.cast.strict",
                "required": False,
                "secret": False,
            },
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)

REPLACE_VALUES_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.values.replace",
        "version": "v1",
        "displayNameKey": "components.transforms.values.replace.name",
        "descriptionKey": "components.transforms.values.replace.description",
        "configFields": [
            {
                "key": "column",
                "type": "text",
                "labelKey": "components.transforms.values.replace.column",
                "required": True,
                "secret": False,
            },
            {
                "key": "replacements",
                "type": "json",
                "labelKey": "components.transforms.values.replace.replacements",
                "required": True,
                "secret": False,
            },
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)

FILL_NULL_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.values.fill-null",
        "version": "v1",
        "displayNameKey": "components.transforms.values.fillNull.name",
        "descriptionKey": "components.transforms.values.fillNull.description",
        "configFields": [
            {
                "key": "column",
                "type": "text",
                "labelKey": "components.transforms.values.fillNull.column",
                "required": True,
                "secret": False,
            },
            {
                "key": "value",
                "type": "json",
                "labelKey": "components.transforms.values.fillNull.value",
                "required": True,
                "secret": False,
            },
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)

NORMALIZE_STRING_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.values.normalize-string",
        "version": "v1",
        "displayNameKey": "components.transforms.values.normalizeString.name",
        "descriptionKey": "components.transforms.values.normalizeString.description",
        "configFields": [
            {
                "key": "column",
                "type": "text",
                "labelKey": "components.transforms.values.normalizeString.column",
                "required": True,
                "secret": False,
            },
            {
                "key": "operation",
                "type": "select",
                "labelKey": "components.transforms.values.normalizeString.operation",
                "required": True,
                "secret": False,
                "options": [
                    {
                        "value": value,
                        "labelKey": f"components.transforms.values.normalizeString.operation.{value}",
                    }
                    for value in ("trim", "lowercase", "uppercase", "normalizeWhitespace")
                ],
            },
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)


class CastColumnTransform(TabularTransform):
    """Cast a configured column to a documented Polars scalar type."""

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Cast the configured column and persist the resulting temporary Dataset."""
        config = CastColumnConfig.model_validate(configuration)
        try:
            result = self._read(dataset).with_columns(
                pl.col(config.column).cast(_POLARS_TYPES[config.data_type], strict=config.strict)
            )
        except _POLARS_ERRORS as error:
            raise ValueTransformError(
                "Configured cast column or target type is invalid."
            ) from error
        return self._persist(result, dataset)


class ReplaceValuesTransform(TabularTransform):
    """Replace configured scalar values while retaining values not in the replacement map."""

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Replace configured values and persist the resulting temporary Dataset."""
        config = ReplaceValuesConfig.model_validate(configuration)
        try:
            result = self._read(dataset).with_columns(
                pl.col(config.column).replace(config.replacements)
            )
        except _POLARS_ERRORS as error:
            raise ValueTransformError(
                "Configured replacement column or values are invalid."
            ) from error
        return self._persist(result, dataset)


class FillNullTransform(TabularTransform):
    """Replace null values in one configured column with a scalar value."""

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Fill configured null values and persist the resulting temporary Dataset."""
        config = FillNullConfig.model_validate(configuration)
        try:
            result = self._read(dataset).with_columns(pl.col(config.column).fill_null(config.value))
        except _POLARS_ERRORS as error:
            raise ValueTransformError("Configured fill-null column or value is invalid.") from error
        return self._persist(result, dataset)


class NormalizeStringTransform(TabularTransform):
    """Normalize text values with deterministic built-in string operations only."""

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Normalize configured text values and persist the resulting temporary Dataset."""
        config = NormalizeStringConfig.model_validate(configuration)
        try:
            result = self._read(dataset).with_columns(_normalization_expression(config))
        except _POLARS_ERRORS as error:
            raise ValueTransformError("Configured text normalization column is invalid.") from error
        return self._persist(result, dataset)


def register_value_transforms(registry: TransformRegistry, storage: DatasetStorage) -> None:
    """Install independent value and type Transform capabilities with one storage adapter."""
    registry.register(CAST_COLUMN_METADATA, CastColumnTransform(storage))
    registry.register(REPLACE_VALUES_METADATA, ReplaceValuesTransform(storage))
    registry.register(FILL_NULL_METADATA, FillNullTransform(storage))
    registry.register(NORMALIZE_STRING_METADATA, NormalizeStringTransform(storage))


_POLARS_TYPES: Final[dict[str, pl.DataType | type[pl.DataType]]] = {
    "text": pl.String,
    "integer": pl.Int64,
    "float": pl.Float64,
    "boolean": pl.Boolean,
    "date": pl.Date,
    "datetime": pl.Datetime,
}


def _normalization_expression(config: NormalizeStringConfig) -> pl.Expr:
    """Build the selected text-only normalization expression after config validation."""
    column = pl.col(config.column).cast(pl.String, strict=True)
    match config.operation:
        case "trim":
            return column.str.strip_chars()
        case "lowercase":
            return column.str.to_lowercase()
        case "uppercase":
            return column.str.to_uppercase()
        case "normalizeWhitespace":
            return column.str.strip_chars().str.replace_all(r"\s+", " ")
