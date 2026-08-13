"""Discovery of built-in component capabilities for generated control-plane metadata."""

from __future__ import annotations

import importlib
import json
import pkgutil
from collections.abc import Iterable

from . import components
from .generated.component_metadata import ComponentMetadata


class ComponentCatalogError(ValueError):
    """Raised when built-in component metadata cannot form one stable capability catalog."""


def built_in_component_metadata() -> tuple[ComponentMetadata, ...]:
    """Return all built-in component metadata in a deterministic, duplicate-free order."""
    discovered = [
        metadata
        for module_name in _component_module_names()
        for metadata in _module_metadata(module_name)
    ]
    ordered = tuple(
        sorted(
            discovered, key=lambda metadata: (metadata.kind.value, metadata.type, metadata.version)
        )
    )
    keys = [(metadata.kind.value, metadata.type, metadata.version) for metadata in ordered]
    if len(keys) != len(set(keys)):
        raise ComponentCatalogError(
            "Built-in component metadata contains duplicate kind, type, and version entries."
        )
    return ordered


def component_catalog_json() -> bytes:
    """Serialize the deterministic catalog without exposing component executors."""
    catalog = [
        metadata.model_dump(mode="json", exclude_none=True)
        for metadata in built_in_component_metadata()
    ]
    return (json.dumps(catalog, indent=2, sort_keys=True) + "\n").encode()


def _component_module_names() -> tuple[str, ...]:
    """List importable component modules while omitting private implementation helpers."""
    module_names = (
        module.name
        for module in pkgutil.walk_packages(components.__path__, f"{components.__name__}.")
        if not module.name.rsplit(".", maxsplit=1)[-1].startswith("_")
    )
    return tuple(sorted(module_names))


def _module_metadata(module_name: str) -> Iterable[ComponentMetadata]:
    """Read only validated metadata constants from one component module, never its executors."""
    module = importlib.import_module(module_name)
    return tuple(
        value
        for name, value in vars(module).items()
        if name.endswith("_METADATA") and isinstance(value, ComponentMetadata)
    )
