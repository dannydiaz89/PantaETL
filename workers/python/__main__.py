"""Start the Python worker application shell."""

from .config import load_config
from .server import run_server


def main() -> None:
    """Load worker configuration and run the health server until shutdown."""
    run_server(load_config("worker", 3020))


if __name__ == "__main__":
    main()
