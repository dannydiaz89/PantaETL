"""Tests for the generated built-in component capability catalog."""

from __future__ import annotations

import json
from pathlib import Path

from workers.python.component_catalog import built_in_component_metadata, component_catalog_json
from workers.python.generated.component_metadata import ComponentMetadata

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = (
    ROOT / "packages" / "contracts" / "src" / "generated" / "component-capability-catalog.json"
)


def test_catalog_contains_each_built_in_component_metadata_entry_once() -> None:
    """Expose every built-in Source, Transform, and Export through one stable catalog."""
    metadata = built_in_component_metadata()
    kinds = {component.kind.value for component in metadata}
    keys = [(component.kind.value, component.type, component.version) for component in metadata]

    assert kinds == {"source", "transform", "export"}
    assert len(keys) == len(set(keys))
    assert len(metadata) == 22


def test_catalog_serializes_only_canonical_component_metadata() -> None:
    """Keep generated capabilities independent from executors and usable secret values."""
    catalog = json.loads(component_catalog_json())

    assert [ComponentMetadata.model_validate(item) for item in catalog] == list(
        built_in_component_metadata()
    )
    assert all(set(item).issubset(ComponentMetadata.model_fields) for item in catalog)
    assert all("executor" not in item and "secretBindings" not in item for item in catalog)


def test_committed_catalog_matches_python_metadata() -> None:
    """Detect stale catalog output before the control plane can publish outdated capabilities."""
    assert CATALOG_PATH.read_bytes() == component_catalog_json()
