"""Row-oriented tabular Transform implementations."""

from dataclasses import dataclass
from typing import Annotated, Final, Literal

import polars as pl
from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...registries import ComponentConfiguration, TransformRegistry
from ...storage import DatasetStorage
from ._tabular import _POLARS_ERRORS, TabularTransform, TabularTransformError


class RowTransformError(TabularTransformError):
    """Raised when a configured row operation cannot safely execute."""


@dataclass(frozen=True, slots=True)
class RowExecutionCharacteristics:
    """Execution behavior that callers can use to plan tabular Transform work."""

    materializes_input: bool
    preserves_input_order: bool


STREAMING_CHARACTERISTICS: Final = RowExecutionCharacteristics(
    materializes_input=False, preserves_input_order=True
)
FULL_DATASET_CHARACTERISTICS: Final = RowExecutionCharacteristics(
    materializes_input=True, preserves_input_order=True
)


class FilterRowsConfig(BaseModel):
    """Configuration for one safe comparison predicate on a tabular column."""

    model_config = ConfigDict(extra="forbid")

    column: Annotated[str, Field(min_length=1)]
    operator: Literal[
        "equals",
        "notEquals",
        "greaterThan",
        "greaterThanOrEqual",
        "lessThan",
        "lessThanOrEqual",
        "isNull",
        "isNotNull",
    ]
    value: JsonValue | None = None

    @model_validator(mode="after")
    def validate_predicate_value(self) -> "FilterRowsConfig":
        """Require scalar values only for predicates that compare values."""
        null_checks = {"isNull", "isNotNull"}
        if self.operator in null_checks and self.value is not None:
            raise ValueError("Null checks do not accept a value.")
        if self.operator not in null_checks:
            if self.value is None:
                raise ValueError("Comparison filters require a value.")
            if isinstance(self.value, list | dict):
                raise ValueError("Comparison filter values must be scalar JSON values.")
        return self


class DeduplicateRowsConfig(BaseModel):
    """Configuration for retaining one or no duplicate rows by selected columns."""

    model_config = ConfigDict(extra="forbid")

    columns: list[Annotated[str, Field(min_length=1)]] | None = None
    keep: Literal["first", "last", "none"] = "first"

    @model_validator(mode="after")
    def reject_duplicate_columns(self) -> "DeduplicateRowsConfig":
        """Reject ambiguous repeated key names before full-dataset execution."""
        if self.columns is not None and len(set(self.columns)) != len(self.columns):
            raise ValueError("Deduplication column names must be unique.")
        return self


class SortColumnConfig(BaseModel):
    """One ordering key for the tabular sort operation."""

    model_config = ConfigDict(extra="forbid")

    column: Annotated[str, Field(min_length=1)]
    descending: bool = False


class SortRowsConfig(BaseModel):
    """Configuration for a stable multi-column sort over the full Dataset."""

    model_config = ConfigDict(extra="forbid")

    columns: Annotated[list[SortColumnConfig], Field(min_length=1)]

    @model_validator(mode="after")
    def reject_duplicate_columns(self) -> "SortRowsConfig":
        """Reject repeated sort keys because their ordering would be misleading."""
        names = [column.column for column in self.columns]
        if len(set(names)) != len(names):
            raise ValueError("Sort column names must be unique.")
        return self


class LimitRowsConfig(BaseModel):
    """Configuration restricting output to the first non-negative number of rows."""

    model_config = ConfigDict(extra="forbid")

    count: Annotated[int, Field(ge=0)]


ROW_FILTER_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.rows.filter",
        "version": "v1",
        "displayNameKey": "components.transforms.rows.filter.name",
        "descriptionKey": "components.transforms.rows.filter.description",
        "configFields": [
            {
                "key": "column",
                "type": "text",
                "labelKey": "components.transforms.rows.filter.column",
                "descriptionKey": "components.transforms.rows.filter.columnDescription",
                "placeholderKey": "components.transforms.rows.filter.columnExample",
                "required": True,
                "secret": False,
            },
            {
                "key": "operator",
                "type": "select",
                "labelKey": "components.transforms.rows.filter.operator",
                "descriptionKey": "components.transforms.rows.filter.operatorDescription",
                "required": True,
                "secret": False,
                "options": [
                    {
                        "value": value,
                        "labelKey": f"components.transforms.rows.filter.operator.{value}",
                    }
                    for value in (
                        "equals",
                        "notEquals",
                        "greaterThan",
                        "greaterThanOrEqual",
                        "lessThan",
                        "lessThanOrEqual",
                        "isNull",
                        "isNotNull",
                    )
                ],
            },
            {
                "key": "value",
                "type": "json",
                "labelKey": "components.transforms.rows.filter.value",
                "descriptionKey": "components.transforms.rows.filter.valueDescription",
                "placeholderKey": "components.transforms.rows.filter.valueExample",
                "required": False,
                "secret": False,
            },
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)

ROW_DEDUPLICATE_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.rows.deduplicate",
        "version": "v1",
        "displayNameKey": "components.transforms.rows.deduplicate.name",
        "descriptionKey": "components.transforms.rows.deduplicate.description",
        "configFields": [
            {
                "key": "columns",
                "type": "json",
                "labelKey": "components.transforms.rows.deduplicate.columns",
                "descriptionKey": "components.transforms.rows.deduplicate.columnsDescription",
                "placeholderKey": "components.transforms.rows.deduplicate.columnsExample",
                "required": False,
                "secret": False,
            },
            {
                "key": "keep",
                "type": "select",
                "labelKey": "components.transforms.rows.deduplicate.keep",
                "descriptionKey": "components.transforms.rows.deduplicate.keepDescription",
                "required": False,
                "secret": False,
                "options": [
                    {
                        "value": value,
                        "labelKey": f"components.transforms.rows.deduplicate.keep.{value}",
                    }
                    for value in ("first", "last", "none")
                ],
            },
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)

ROW_SORT_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.rows.sort",
        "version": "v1",
        "displayNameKey": "components.transforms.rows.sort.name",
        "descriptionKey": "components.transforms.rows.sort.description",
        "configFields": [
            {
                "key": "columns",
                "type": "json",
                "labelKey": "components.transforms.rows.sort.columns",
                "descriptionKey": "components.transforms.rows.sort.columnsDescription",
                "placeholderKey": "components.transforms.rows.sort.columnsExample",
                "required": True,
                "secret": False,
            }
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)

ROW_LIMIT_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.rows.limit",
        "version": "v1",
        "displayNameKey": "components.transforms.rows.limit.name",
        "descriptionKey": "components.transforms.rows.limit.description",
        "configFields": [
            {
                "key": "count",
                "type": "number",
                "labelKey": "components.transforms.rows.limit.count",
                "descriptionKey": "components.transforms.rows.limit.countDescription",
                "placeholderKey": "components.transforms.rows.limit.countExample",
                "required": True,
                "secret": False,
            }
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)


class FilterRowsTransform(TabularTransform):
    """Filter rows with a safe declarative predicate instead of executable user code."""

    execution_characteristics: Final = STREAMING_CHARACTERISTICS

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Filter input rows by one configured predicate and persist the output."""
        config = FilterRowsConfig.model_validate(configuration)
        try:
            frame = self._read(dataset)
            expression = _filter_expression(config)
            result = frame.filter(expression)
        except _POLARS_ERRORS as error:
            raise RowTransformError("Configured filter column or value is invalid.") from error
        return self._persist(result, dataset)


class DeduplicateRowsTransform(TabularTransform):
    """Remove duplicates while explicitly preserving the chosen input row order."""

    execution_characteristics: Final = FULL_DATASET_CHARACTERISTICS

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Deduplicate configured rows and persist the resulting temporary Dataset."""
        config = DeduplicateRowsConfig.model_validate(configuration)
        try:
            result = self._read(dataset).unique(
                subset=config.columns,
                keep=config.keep,
                maintain_order=True,
            )
        except _POLARS_ERRORS as error:
            raise RowTransformError("Configured deduplication columns are unavailable.") from error
        return self._persist(result, dataset)


class SortRowsTransform(TabularTransform):
    """Sort a complete Dataset using declared columns and directions."""

    execution_characteristics: Final = FULL_DATASET_CHARACTERISTICS

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Sort configured columns and persist the resulting temporary Dataset."""
        config = SortRowsConfig.model_validate(configuration)
        try:
            result = self._read(dataset).sort(
                [column.column for column in config.columns],
                descending=[column.descending for column in config.columns],
                maintain_order=True,
            )
        except _POLARS_ERRORS as error:
            raise RowTransformError("Configured sort columns are unavailable.") from error
        return self._persist(result, dataset)


class LimitRowsTransform(TabularTransform):
    """Restrict output to a non-negative number of leading input rows."""

    execution_characteristics: Final = STREAMING_CHARACTERISTICS

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Limit rows and persist the resulting temporary Dataset."""
        config = LimitRowsConfig.model_validate(configuration)
        return self._persist(self._read(dataset).head(config.count), dataset)


def register_row_transforms(registry: TransformRegistry, storage: DatasetStorage) -> None:
    """Install independent row Transform capabilities with one storage adapter."""
    registry.register(ROW_FILTER_METADATA, FilterRowsTransform(storage))
    registry.register(ROW_DEDUPLICATE_METADATA, DeduplicateRowsTransform(storage))
    registry.register(ROW_SORT_METADATA, SortRowsTransform(storage))
    registry.register(ROW_LIMIT_METADATA, LimitRowsTransform(storage))


def _filter_expression(config: FilterRowsConfig) -> pl.Expr:
    """Translate the validated declarative predicate into a Polars expression."""
    column = pl.col(config.column)
    match config.operator:
        case "equals":
            return column == config.value
        case "notEquals":
            return column != config.value
        case "greaterThan":
            return column > config.value
        case "greaterThanOrEqual":
            return column >= config.value
        case "lessThan":
            return column < config.value
        case "lessThanOrEqual":
            return column <= config.value
        case "isNull":
            return column.is_null()
        case "isNotNull":
            return column.is_not_null()
