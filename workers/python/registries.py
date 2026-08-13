"""Modular registries for Source, Transform, and Export component executors."""

import json
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol

from .generated.artifact_descriptor import ArtifactDescriptor
from .generated.component_metadata import ComponentMetadata, Kind, Option, Type
from .generated.dataset_descriptor import DatasetDescriptor
from .generated.source_execution_request import SourceExecutionRequest

ComponentConfiguration = Mapping[str, object]


class ComponentRegistrationError(ValueError):
    """Raised when a component cannot be safely registered or resolved."""


class ComponentConfigurationError(ValueError):
    """Raised when non-secret component values do not match component metadata."""


class SourceExecutor(Protocol):
    """Execute a Source request and return its temporary Dataset descriptor."""

    def __call__(self, request: SourceExecutionRequest) -> DatasetDescriptor: ...


class TransformExecutor(Protocol):
    """Transform a Dataset without access to connection credentials or network clients."""

    def __call__(
        self,
        dataset: DatasetDescriptor,
        configuration: ComponentConfiguration,
    ) -> DatasetDescriptor: ...


class ExportExecutor(Protocol):
    """Deliver a Dataset using destination-specific configuration and binding resolution."""

    def __call__(
        self,
        dataset: DatasetDescriptor,
        configuration: ComponentConfiguration,
    ) -> ArtifactDescriptor | None: ...


@dataclass(frozen=True, slots=True)
class RegisteredComponent[ExecutorT]:
    """One metadata-validated component and its focused executor implementation."""

    metadata: ComponentMetadata
    executor: ExecutorT


class ComponentRegistry[ExecutorT]:
    """Registry for one component kind that avoids central executor switch statements."""

    def __init__(self, component_kind: Kind) -> None:
        """Create an empty registry that accepts only the supplied component kind."""
        self._component_kind = component_kind
        self._components: dict[tuple[str, str], RegisteredComponent[ExecutorT]] = {}

    def register(self, metadata: ComponentMetadata, executor: ExecutorT) -> None:
        """Register a unique type-and-version pair after verifying its component category."""
        if metadata.kind != self._component_kind:
            raise ComponentRegistrationError(
                f"Expected a {self._component_kind} component, received {metadata.kind}."
            )

        key = _component_key(metadata.type, metadata.version)
        if key in self._components:
            raise ComponentRegistrationError(
                f"Component {metadata.type}@{metadata.version} is already registered."
            )

        self._components[key] = RegisteredComponent(metadata=metadata, executor=executor)

    def resolve(
        self, component_type: str, component_version: str
    ) -> RegisteredComponent[ExecutorT]:
        """Return an installed component or fail before execution with safe capability context."""
        component = self._components.get(_component_key(component_type, component_version))
        if component is None:
            raise ComponentRegistrationError(
                f"Component {component_type}@{component_version} is unavailable."
            )

        return component

    def validate_configuration(
        self,
        component_type: str,
        component_version: str,
        values: ComponentConfiguration,
    ) -> None:
        """Validate portable non-secret values against the registered component metadata."""
        component = self.resolve(component_type, component_version)
        validate_component_configuration(component.metadata, values)

    def metadata(self) -> tuple[ComponentMetadata, ...]:
        """Return installed metadata in registration order for capability discovery."""
        return tuple(component.metadata for component in self._components.values())


class SourceRegistry(ComponentRegistry[SourceExecutor]):
    """Registry for independent Source executor modules."""

    def __init__(self) -> None:
        """Create an empty Source registry."""
        super().__init__(Kind.source)


class TransformRegistry(ComponentRegistry[TransformExecutor]):
    """Registry for independent credential-free Transform executor modules."""

    def __init__(self) -> None:
        """Create an empty Transform registry."""
        super().__init__(Kind.transform)


class ExportRegistry(ComponentRegistry[ExportExecutor]):
    """Registry for independent Export executor modules."""

    def __init__(self) -> None:
        """Create an empty Export registry."""
        super().__init__(Kind.export)


def validate_component_configuration(
    metadata: ComponentMetadata, values: ComponentConfiguration
) -> None:
    """Enforce metadata-declared required fields, control types, options, and secret boundaries."""
    fields_by_key = {field.key: field for field in metadata.configFields}
    unexpected_keys = sorted(set(values).difference(fields_by_key))
    if unexpected_keys:
        raise ComponentConfigurationError(
            f"Component {metadata.type} does not define values for: {', '.join(unexpected_keys)}."
        )

    for field in metadata.configFields:
        value = values.get(field.key)
        if field.secret and field.key in values:
            raise ComponentConfigurationError(
                f"Secret field {field.key} must be supplied through a secret binding."
            )
        if field.required and not field.secret and field.key not in values:
            raise ComponentConfigurationError(f"Component {metadata.type} requires {field.key}.")
        if value is not None:
            _validate_field_value(field.type, field.key, value, field.options)


def _validate_field_value(
    field_type: Type,
    key: str,
    value: object,
    options: list[Option] | None,
) -> None:
    """Validate one portable configuration value without resolving secrets."""
    if field_type in {Type.text, Type.textarea} and not isinstance(value, str):
        raise ComponentConfigurationError(f"Configuration field {key} must be text.")
    if field_type is Type.number and (
        not isinstance(value, int | float) or isinstance(value, bool)
    ):
        raise ComponentConfigurationError(f"Configuration field {key} must be a number.")
    if field_type is Type.boolean and not isinstance(value, bool):
        raise ComponentConfigurationError(f"Configuration field {key} must be a boolean.")
    if field_type is Type.select:
        _validate_select_value(key, value, options)
    if field_type is Type.json:
        _validate_json_value(key, value)


def _validate_select_value(key: str, value: object, options: list[Option] | None) -> None:
    """Validate that a select value is an option declared by component metadata."""
    if not isinstance(value, str):
        raise ComponentConfigurationError(f"Configuration field {key} must select a string option.")
    option_values = {option.value for option in options or []}
    if value not in option_values:
        raise ComponentConfigurationError(
            f"Configuration field {key} selects an unavailable option."
        )


def _validate_json_value(key: str, value: object) -> None:
    """Ensure JSON control values remain portable across the worker boundary."""
    try:
        json.dumps(value)
    except (TypeError, ValueError) as error:
        raise ComponentConfigurationError(
            f"Configuration field {key} must be JSON-compatible."
        ) from error


def _component_key(component_type: str, component_version: str) -> tuple[str, str]:
    """Build the stable registry key shared by component lookup operations."""
    return (component_type, component_version)
