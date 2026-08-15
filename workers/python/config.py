"""Configuration for the Python worker runtime."""

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, cast
from uuid import UUID, uuid4

LogLevel = Literal["debug", "info", "warning", "error"]

PRODUCTION_STORAGE_ROOT = "/var/lib/pantaetl/storage"
DEVELOPMENT_STORAGE_DIRECTORY = "storage"
IMPORT_DIRECTORY = "imports"
_WORKSPACE_MARKER = "pnpm-workspace.yaml"


@dataclass(frozen=True)
class WorkerConfig:
    """Environment-derived settings used to start and identify a worker process."""

    host: str
    port: int
    service_name: str
    worker_id: UUID
    log_level: LogLevel
    database_url: str = ""
    storage_root: str = PRODUCTION_STORAGE_ROOT
    source_input_root: str = f"{PRODUCTION_STORAGE_ROOT}/{IMPORT_DIRECTORY}"
    poll_interval_seconds: float = 1.0


def _read_port(value: str | None, fallback: int) -> int:
    try:
        port = int(value or fallback)
    except ValueError as error:
        raise ValueError("PORT must be an integer between 1 and 65535.") from error

    if not 1 <= port <= 65_535:
        raise ValueError("PORT must be an integer between 1 and 65535.")

    return port


def _read_log_level(value: str | None) -> LogLevel:
    normalized = (value or "info").lower()
    valid_levels = {"debug", "info", "warning", "error"}

    if normalized not in valid_levels:
        raise ValueError("LOG_LEVEL must be one of debug, info, warning, or error.")

    return cast(LogLevel, normalized)


def _read_worker_id(value: str | None) -> UUID:
    if value is None or value == "":
        return uuid4()

    try:
        return UUID(value)
    except ValueError as error:
        raise ValueError("WORKER_ID must be a UUID.") from error


def _read_positive_seconds(value: str | None, fallback: float) -> float:
    """Read a bounded positive worker polling interval."""
    try:
        seconds = float(value or fallback)
    except ValueError as error:
        raise ValueError("WORKER_POLL_INTERVAL_SECONDS must be positive.") from error

    if seconds <= 0:
        raise ValueError("WORKER_POLL_INTERVAL_SECONDS must be positive.")
    return seconds


def _workspace_root() -> Path:
    """Locate the workspace root from this module rather than the working directory.

    Services start from different directories, so resolving against the current
    one would give each of them a different storage root. Falls back to the
    working directory when the marker is absent, which means the worker runs
    outside the workspace and should have been given an explicit STORAGE_ROOT.
    """
    for directory in Path(__file__).resolve().parents:
        if (directory / _WORKSPACE_MARKER).is_file():
            return directory
    return Path.cwd()


def resolve_storage_root(environment: Mapping[str, str] | None = None) -> str:
    """Resolve the internal storage root shared with the web and retention services.

    Web, worker, and collector read and write one tree, so a disagreement here
    looks like data loss rather than a misconfiguration. An explicit STORAGE_ROOT
    always wins. Otherwise a development process uses a directory inside the
    workspace, which an ordinary account can write, and anything else uses the
    packaged location. Production is the default so a deployment that omits the
    variable cannot start writing into a working copy.
    """
    source = os.environ if environment is None else environment
    configured = source.get("STORAGE_ROOT", "").strip()
    if configured:
        return str(Path(configured).resolve())

    if source.get("PANTAETL_ENV", "").strip().lower() == "development":
        return str(_workspace_root() / DEVELOPMENT_STORAGE_DIRECTORY)
    return PRODUCTION_STORAGE_ROOT


def resolve_source_input_root(environment: Mapping[str, str] | None = None) -> str:
    """Resolve the directory file Sources read, which sits inside internal storage."""
    source = os.environ if environment is None else environment
    configured = source.get("SOURCE_INPUT_ROOT", "").strip()
    if configured:
        return str(Path(configured).resolve())
    return str(Path(resolve_storage_root(source)) / IMPORT_DIRECTORY)


def load_config(service_name: str, default_port: int) -> WorkerConfig:
    """Read worker settings from the environment and validate their safe bounds."""
    return WorkerConfig(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=_read_port(os.environ.get("PORT"), default_port),
        service_name=service_name,
        worker_id=_read_worker_id(os.environ.get("WORKER_ID")),
        log_level=_read_log_level(os.environ.get("LOG_LEVEL")),
        database_url=os.environ.get("DATABASE_URL", "").strip(),
        storage_root=resolve_storage_root(),
        source_input_root=resolve_source_input_root(),
        poll_interval_seconds=_read_positive_seconds(
            os.environ.get("WORKER_POLL_INTERVAL_SECONDS"), 1.0
        ),
    )
