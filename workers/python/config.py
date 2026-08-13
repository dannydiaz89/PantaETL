"""Configuration for the Python worker runtime."""

import os
from dataclasses import dataclass
from typing import Literal, cast
from uuid import UUID, uuid4

LogLevel = Literal["debug", "info", "warning", "error"]


@dataclass(frozen=True)
class WorkerConfig:
    """Environment-derived settings used to start and identify a worker process."""

    host: str
    port: int
    service_name: str
    worker_id: UUID
    log_level: LogLevel


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


def load_config(service_name: str, default_port: int) -> WorkerConfig:
    """Read worker settings from the environment and validate their safe bounds."""
    return WorkerConfig(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=_read_port(os.environ.get("PORT"), default_port),
        service_name=service_name,
        worker_id=_read_worker_id(os.environ.get("WORKER_ID")),
        log_level=_read_log_level(os.environ.get("LOG_LEVEL")),
    )
