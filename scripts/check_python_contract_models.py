"""Fail when generated Pydantic contract models do not match canonical schemas."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATED_DIRECTORY = "workers/python/generated"


def run(command: list[str]) -> None:
    """Run a repository command and preserve its failure status."""
    subprocess.run(command, check=True, cwd=ROOT)


def main() -> None:
    """Ensure generated models match canonical schemas without rewriting them."""
    run([sys.executable, "scripts/generate_python_contract_models.py", "--check"])
    run(["git", "diff", "--exit-code", "--", GENERATED_DIRECTORY])

    untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard", "--", GENERATED_DIRECTORY],
        check=True,
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if untracked.stdout:
        raise SystemExit(f"Generated Pydantic models are untracked:\n{untracked.stdout}")


if __name__ == "__main__":
    main()
