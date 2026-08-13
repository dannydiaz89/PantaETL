"""Safe structured logging for the Python worker application shell."""

import json
from typing import Literal

LogLevel = Literal["error", "info"]


def write_log(level: LogLevel, message: str, **context: object) -> None:
    """Write a structured service event without record contents or credentials."""
    print(json.dumps({"level": level, "message": message, **context}, sort_keys=True), flush=True)
