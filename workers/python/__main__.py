"""Start the Python worker application shell."""

from .config import load_config
from .execution import create_execution_service
from .server import run_server


def main() -> None:
    """Load worker configuration and run health reporting with queue execution."""
    config = load_config("worker", 3020)
    run_server(config, create_execution_service(config))


if __name__ == "__main__":
    main()
