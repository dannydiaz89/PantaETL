"""Safe structured logging for the Python worker runtime."""

import json
import re
from collections.abc import Mapping
from typing import Literal
from uuid import UUID

LogLevel = Literal["debug", "info", "warning", "error"]
_REDACTED = "[REDACTED]"
_SENSITIVE_KEY = re.compile(
    r"(?:api[_-]?key|api[_-]?token|authorization|credential|password|secret|token)",
    re.IGNORECASE,
)

LogValue = None | bool | float | int | str | list["LogValue"] | dict[str, "LogValue"]


def _safe_value(value: object, key: str | None = None) -> LogValue:
    """Convert log context to JSON-safe data while redacting sensitive values."""
    if key is not None and _SENSITIVE_KEY.search(key):
        return _REDACTED
    if value is None or isinstance(value, bool | float | int | str):
        return value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Mapping):
        return {
            str(item_key): _safe_value(item_value, str(item_key))
            for item_key, item_value in value.items()
        }
    if isinstance(value, list | tuple):
        return [_safe_value(item) for item in value]

    return str(value)


def write_log(level: LogLevel, message: str, **context: object) -> None:
    """Write a structured service event without record contents or credentials."""
    payload = {
        "level": level,
        "message": message,
        **{key: _safe_value(value, key) for key, value in context.items()},
    }
    print(json.dumps(payload, sort_keys=True), flush=True)
