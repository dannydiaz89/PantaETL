"""Column-oriented tabular Transform implementations."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...registries import ComponentConfiguration, TransformRegistry
from ...storage import DatasetStorage
from ._tabular import _POLARS_ERRORS, TabularTransform, TabularTransformError


class ColumnTransformError(TabularTransformError):
    """Raised when a column operation refers to an invalid column arrangement."""


class SelectColumnsConfig(BaseModel):
    """Configuration selecting the ordered set of columns retained in output."""

    model_config = ConfigDict(extra="forbid")

    columns: Annotated[list[Annotated[str, Field(min_length=1)]], Field(min_length=1)]

    @model_validator(mode="after")
    def reject_duplicate_columns(self) -> "SelectColumnsConfig":
        """Reject ambiguous repeated column selections before Polars execution."""
        if len(set(self.columns)) != len(self.columns):
            raise ValueError("Column names must be unique.")
        return self


class RenameColumnsConfig(BaseModel):
    """Configuration mapping existing column names to their new names."""

    model_config = ConfigDict(extra="forbid")

    renames: dict[Annotated[str, Field(min_length=1)], Annotated[str, Field(min_length=1)]]

    @model_validator(mode="after")
    def reject_duplicate_targets(self) -> "RenameColumnsConfig":
        """Reject rename maps that would produce duplicate output names."""
        if len(set(self.renames.values())) != len(self.renames):
            raise ValueError("Renamed column names must be unique.")
        return self


class DropColumnsConfig(BaseModel):
    """Configuration listing columns that should be removed from output."""

    model_config = ConfigDict(extra="forbid")

    columns: list[Annotated[str, Field(min_length=1)]]

    @model_validator(mode="after")
    def reject_duplicate_columns(self) -> "DropColumnsConfig":
        """Reject repeated removals so configuration errors remain explicit."""
        if len(set(self.columns)) != len(self.columns):
            raise ValueError("Column names must be unique.")
        return self


class ReorderColumnsConfig(BaseModel):
    """Configuration listing columns to move to the front in the given order."""

    model_config = ConfigDict(extra="forbid")

    columns: list[Annotated[str, Field(min_length=1)]]

    @model_validator(mode="after")
    def reject_duplicate_columns(self) -> "ReorderColumnsConfig":
        """Reject ambiguous repeated column positions before execution."""
        if len(set(self.columns)) != len(self.columns):
            raise ValueError("Column names must be unique.")
        return self


COLUMN_SELECT_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.columns.select",
        "version": "v1",
        "displayNameKey": "components.transforms.columns.select.name",
        "descriptionKey": "components.transforms.columns.select.description",
        "configFields": [
            {
                "key": "columns",
                "type": "json",
                "labelKey": "components.transforms.columns.select.columns",
                "required": True,
                "secret": False,
            }
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)

COLUMN_RENAME_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.columns.rename",
        "version": "v1",
        "displayNameKey": "components.transforms.columns.rename.name",
        "descriptionKey": "components.transforms.columns.rename.description",
        "configFields": [
            {
                "key": "renames",
                "type": "json",
                "labelKey": "components.transforms.columns.rename.renames",
                "required": True,
                "secret": False,
            }
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)

COLUMN_DROP_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.columns.drop",
        "version": "v1",
        "displayNameKey": "components.transforms.columns.drop.name",
        "descriptionKey": "components.transforms.columns.drop.description",
        "configFields": [
            {
                "key": "columns",
                "type": "json",
                "labelKey": "components.transforms.columns.drop.columns",
                "required": True,
                "secret": False,
            }
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)

COLUMN_REORDER_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "transform",
        "type": "transform.columns.reorder",
        "version": "v1",
        "displayNameKey": "components.transforms.columns.reorder.name",
        "descriptionKey": "components.transforms.columns.reorder.description",
        "configFields": [
            {
                "key": "columns",
                "type": "json",
                "labelKey": "components.transforms.columns.reorder.columns",
                "required": True,
                "secret": False,
            }
        ],
        "inputFamilies": ["tabular"],
        "outputFamilies": ["tabular"],
    }
)


class SelectColumnsTransform(TabularTransform):
    """Persist only configured tabular columns, retaining their requested order."""

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Select configured columns and persist the resulting temporary Dataset."""
        config = SelectColumnsConfig.model_validate(configuration)
        try:
            frame = self._read(dataset).select(config.columns)
        except _POLARS_ERRORS as error:
            raise ColumnTransformError("Configured select columns are unavailable.") from error
        return self._persist(frame, dataset)


class RenameColumnsTransform(TabularTransform):
    """Persist tabular data after renaming configured columns."""

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Rename configured columns and persist the resulting temporary Dataset."""
        config = RenameColumnsConfig.model_validate(configuration)
        try:
            frame = self._read(dataset).rename(config.renames, strict=True)
        except _POLARS_ERRORS as error:
            raise ColumnTransformError(
                "Configured rename columns are unavailable or conflict."
            ) from error
        return self._persist(frame, dataset)


class DropColumnsTransform(TabularTransform):
    """Persist tabular data after removing configured columns."""

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Drop configured columns and persist the resulting temporary Dataset."""
        config = DropColumnsConfig.model_validate(configuration)
        try:
            frame = self._read(dataset).drop(config.columns, strict=True)
        except _POLARS_ERRORS as error:
            raise ColumnTransformError("Configured drop columns are unavailable.") from error
        return self._persist(frame, dataset)


class ReorderColumnsTransform(TabularTransform):
    """Move configured columns to the front without dropping other columns."""

    def __call__(
        self, dataset: DatasetDescriptor, configuration: ComponentConfiguration
    ) -> DatasetDescriptor:
        """Reorder configured columns and persist the resulting temporary Dataset."""
        config = ReorderColumnsConfig.model_validate(configuration)
        frame = self._read(dataset)
        missing_columns = set(config.columns).difference(frame.columns)
        if missing_columns:
            raise ColumnTransformError("Configured reorder columns are unavailable.")
        ordered_columns = [
            *config.columns,
            *(name for name in frame.columns if name not in config.columns),
        ]
        return self._persist(frame.select(ordered_columns), dataset)


def register_column_transforms(registry: TransformRegistry, storage: DatasetStorage) -> None:
    """Install independent column Transform capabilities with one storage adapter."""
    registry.register(COLUMN_SELECT_METADATA, SelectColumnsTransform(storage))
    registry.register(COLUMN_RENAME_METADATA, RenameColumnsTransform(storage))
    registry.register(COLUMN_DROP_METADATA, DropColumnsTransform(storage))
    registry.register(COLUMN_REORDER_METADATA, ReorderColumnsTransform(storage))
