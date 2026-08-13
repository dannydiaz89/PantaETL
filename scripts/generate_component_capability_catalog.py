"""Generate the static control-plane capability catalog from built-in Python metadata."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = (
    ROOT / "packages" / "contracts" / "src" / "generated" / "component-capability-catalog.json"
)

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from workers.python.component_catalog import component_catalog_json  # noqa: E402


def generate_catalog() -> None:
    """Write the committed capability catalog used by the control plane."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(component_catalog_json())


def check_catalog() -> None:
    """Fail when the committed catalog does not match current Python component metadata."""
    expected = component_catalog_json()
    try:
        actual = OUTPUT_PATH.read_bytes()
    except FileNotFoundError as error:
        raise SystemExit("Component capability catalog is missing. Run pnpm generate.") from error
    if actual != expected:
        raise SystemExit("Component capability catalog is stale. Run pnpm generate.")


def main() -> None:
    """Generate or verify the static built-in component capability catalog."""
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify generated catalog without writing to the repository",
    )
    arguments = parser.parse_args()
    if arguments.check:
        check_catalog()
    else:
        generate_catalog()


if __name__ == "__main__":
    main()
