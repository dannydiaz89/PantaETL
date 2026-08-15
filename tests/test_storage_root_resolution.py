"""The worker must resolve the same internal storage root as the other services."""

from pathlib import Path

from workers.python.config import (
    DEVELOPMENT_STORAGE_DIRECTORY,
    PRODUCTION_STORAGE_ROOT,
    resolve_source_input_root,
    resolve_storage_root,
)


def test_packaged_location_is_the_default() -> None:
    """An unmarked deployment writes where the package expects."""
    assert resolve_storage_root({}) == PRODUCTION_STORAGE_ROOT


def test_a_malformed_flag_stays_on_the_packaged_location() -> None:
    """A typo must not quietly redirect a real deployment into a working copy."""
    assert resolve_storage_root({"PANTAETL_ENV": "dev"}) == PRODUCTION_STORAGE_ROOT
    assert resolve_storage_root({"PANTAETL_ENV": "Production"}) == PRODUCTION_STORAGE_ROOT
    assert resolve_storage_root({"PANTAETL_ENV": ""}) == PRODUCTION_STORAGE_ROOT


def test_development_uses_a_writable_workspace_directory() -> None:
    """A development worker writes inside the workspace it runs from."""
    root = Path(resolve_storage_root({"PANTAETL_ENV": "development"}))

    assert root.is_absolute()
    assert root.name == DEVELOPMENT_STORAGE_DIRECTORY
    assert (root.parent / "pnpm-workspace.yaml").is_file()


def test_development_matches_the_typescript_resolution() -> None:
    """Both runtimes must agree, because one writes what the other reads."""
    root = Path(resolve_storage_root({"PANTAETL_ENV": "development"}))
    workspace_root = Path(__file__).resolve().parents[1]

    assert root == workspace_root / DEVELOPMENT_STORAGE_DIRECTORY


def test_an_explicit_location_wins() -> None:
    """A mounted storage location overrides the deployment shape."""
    assert resolve_storage_root({"STORAGE_ROOT": "/mnt/shared"}) == "/mnt/shared"
    assert (
        resolve_storage_root({"PANTAETL_ENV": "development", "STORAGE_ROOT": "/mnt/shared"})
        == "/mnt/shared"
    )


def test_a_blank_location_is_ignored() -> None:
    """Blank configuration must not resolve to the filesystem root."""
    assert resolve_storage_root({"STORAGE_ROOT": "   "}) == PRODUCTION_STORAGE_ROOT


def test_sources_read_from_inside_internal_storage() -> None:
    """Uploads land in the import directory, so Sources must resolve against it."""
    assert resolve_source_input_root({}) == f"{PRODUCTION_STORAGE_ROOT}/imports"
    assert resolve_source_input_root({"STORAGE_ROOT": "/mnt/shared"}) == "/mnt/shared/imports"
    assert resolve_source_input_root({"SOURCE_INPUT_ROOT": "/mnt/imports"}) == "/mnt/imports"
