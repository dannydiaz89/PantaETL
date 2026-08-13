"""Configuration for the Python worker application shell."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ServiceConfig:
    """Host and port settings required to start a worker service shell."""

    host: str
    port: int
    service_name: str


def _read_port(value: str | None, fallback: int) -> int:
    port = int(value or fallback)

    if not 1 <= port <= 65_535:
        raise ValueError("PORT must be an integer between 1 and 65535.")

    return port


def load_config(service_name: str, default_port: int) -> ServiceConfig:
    """Read environment configuration without adding worker execution behavior."""
    return ServiceConfig(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=_read_port(os.environ.get("PORT"), default_port),
        service_name=service_name,
    )
