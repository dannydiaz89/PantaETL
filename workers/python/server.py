"""HTTP health endpoint for the Python worker runtime."""

import json
import signal
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Event, Thread
from types import FrameType
from typing import cast

from .config import WorkerConfig
from .execution import WorkerExecutionService
from .service_logging import write_log


class HealthHandler(BaseHTTPRequestHandler):
    """Serve worker runtime health while rejecting unimplemented routes."""

    server_version = "PantaETLWorker/0.0"

    def do_GET(self) -> None:
        """Return worker health or a safe not-found response."""
        if self.path == "/health":
            worker_server = cast("WorkerHTTPServer", self.server)
            self._send_json(
                HTTPStatus.OK,
                {
                    "service": worker_server.config.service_name,
                    "status": "ok",
                    "workerId": str(worker_server.config.worker_id),
                },
            )
            return

        self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def log_message(self, _format: str, *_args: object) -> None:
        """Suppress default request logs until shared observability is available."""

    def _send_json(self, status: HTTPStatus, payload: dict[str, str]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class WorkerHTTPServer(ThreadingHTTPServer):
    """HTTP server carrying immutable runtime settings for health responses."""

    def __init__(self, config: WorkerConfig) -> None:
        """Bind a health server to the configured worker address and identity."""
        super().__init__((config.host, config.port), HealthHandler)
        self.config = config


def create_server(config: WorkerConfig) -> WorkerHTTPServer:
    """Create a worker health server without starting its request loop."""
    return WorkerHTTPServer(config)


def run_server(config: WorkerConfig, execution: WorkerExecutionService | None = None) -> None:
    """Run health reporting and optional queue execution until a shutdown signal arrives."""
    server = create_server(config)
    stopped = Event()
    executor_thread = (
        Thread(
            target=execution.run_until_stopped,
            args=(stopped, config.poll_interval_seconds),
            daemon=True,
        )
        if execution is not None
        else None
    )

    def stop(signum: int, _frame: FrameType | None) -> None:
        signal_name = signal.Signals(signum).name
        write_log("info", "service_stopping", service=config.service_name, signal=signal_name)
        stopped.set()
        Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, cast(signal.Handlers, stop))
    signal.signal(signal.SIGTERM, cast(signal.Handlers, stop))
    write_log(
        "info",
        "service_started",
        host=config.host,
        port=config.port,
        service=config.service_name,
    )
    if executor_thread is not None:
        executor_thread.start()

    try:
        server.serve_forever()
    finally:
        stopped.set()
        server.server_close()
        if executor_thread is not None:
            executor_thread.join(timeout=config.poll_interval_seconds + 1)
        write_log("info", "service_stopped", service=config.service_name)
