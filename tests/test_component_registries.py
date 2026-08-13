"""Tests for modular metadata-backed worker component registries."""

from typing import cast

import pytest

from workers.python.generated.component_metadata import ComponentMetadata
from workers.python.generated.dataset_descriptor import DatasetDescriptor
from workers.python.generated.source_execution_request import SourceExecutionRequest
from workers.python.registries import (
    ComponentConfigurationError,
    ComponentRegistrationError,
    ExportRegistry,
    SourceExecutor,
    SourceRegistry,
    TransformRegistry,
)


def component_metadata(kind: str, component_type: str) -> ComponentMetadata:
    """Build a representative metadata contract for registry tests."""
    return ComponentMetadata.model_validate(
        {
            "kind": kind,
            "type": component_type,
            "version": "v1",
            "displayNameKey": "component.name",
            "descriptionKey": "component.description",
            "configFields": [
                {
                    "key": "endpoint",
                    "type": "text",
                    "labelKey": "component.endpoint",
                    "required": True,
                    "secret": False,
                },
                {
                    "key": "apiToken",
                    "type": "text",
                    "labelKey": "component.token",
                    "required": True,
                    "secret": True,
                },
                {
                    "key": "format",
                    "type": "select",
                    "labelKey": "component.format",
                    "required": False,
                    "secret": False,
                    "options": [{"value": "json", "labelKey": "component.format.json"}],
                },
            ],
            "inputFamilies": [] if kind == "source" else ["document"],
            "outputFamilies": ["document"] if kind != "export" else [],
        }
    )


class TestSourceExecutor:
    """Placeholder executor used only to register a correctly typed Source module."""

    def __call__(self, _request: SourceExecutionRequest) -> DatasetDescriptor:
        """Fail if a registry test accidentally executes a placeholder component."""
        raise AssertionError("Registry tests do not execute registered components.")


source_executor = cast(SourceExecutor, TestSourceExecutor())


def test_source_registry_registers_and_validates_metadata_backed_configuration() -> None:
    """Registering a Source module avoids a central executor switch statement."""
    registry = SourceRegistry()
    metadata = component_metadata("source", "source.test")
    registry.register(metadata, source_executor)

    registry.validate_configuration("source.test", "v1", {"endpoint": "https://example.test"})
    assert registry.resolve("source.test", "v1").metadata == metadata


def test_registry_rejects_wrong_kind_duplicate_and_missing_capability() -> None:
    """Keep registries focused on one component kind and stable capability versions."""
    registry = SourceRegistry()
    registry.register(component_metadata("source", "source.test"), source_executor)

    with pytest.raises(ComponentRegistrationError, match="already registered"):
        registry.register(component_metadata("source", "source.test"), source_executor)
    with pytest.raises(ComponentRegistrationError, match="Expected a source"):
        registry.register(component_metadata("export", "export.test"), source_executor)
    with pytest.raises(ComponentRegistrationError, match="unavailable"):
        registry.resolve("source.missing", "v1")


def test_metadata_configuration_validation_preserves_secret_binding_boundary() -> None:
    """Reject inline secrets, missing fields, and unknown portable values."""
    registry = SourceRegistry()
    registry.register(component_metadata("source", "source.test"), source_executor)

    with pytest.raises(ComponentConfigurationError, match="secret binding"):
        registry.validate_configuration(
            "source.test",
            "v1",
            {"endpoint": "https://example.test", "apiToken": "usable-secret"},
        )
    with pytest.raises(ComponentConfigurationError, match="requires endpoint"):
        registry.validate_configuration("source.test", "v1", {})
    with pytest.raises(ComponentConfigurationError, match="does not define"):
        registry.validate_configuration(
            "source.test", "v1", {"endpoint": "https://example.test", "unknown": "value"}
        )


def test_registry_types_remain_separate_for_source_transform_and_export_modules() -> None:
    """Expose focused registries for each execution responsibility boundary."""
    assert isinstance(SourceRegistry(), SourceRegistry)
    assert isinstance(TransformRegistry(), TransformRegistry)
    assert isinstance(ExportRegistry(), ExportRegistry)
