"""Tests for the validated Python worker runtime foundation."""

import json
from copy import deepcopy
from pathlib import Path
from threading import Thread
from typing import cast
from urllib.request import urlopen
from uuid import UUID

import pytest
from pydantic import ValidationError

from workers.python.config import WorkerConfig, load_config
from workers.python.runtime import ContractConsistencyError, load_runtime_context
from workers.python.server import create_server
from workers.python.service_logging import write_log

FixtureSections = dict[str, dict[str, dict[str, object]]]
WORKER_ID = UUID("123e4567-e89b-12d3-a456-426614174015")


def _load_fixtures() -> FixtureSections:
    """Load the shared valid worker-boundary contract examples."""
    fixture_path = Path(__file__).parent / "fixtures" / "contract-interoperability.json"
    return cast(FixtureSections, json.loads(fixture_path.read_text(encoding="utf-8")))


def _runtime_payloads() -> tuple[dict[str, object], dict[str, object]]:
    """Build compatible Job and Source execution request payloads."""
    fixture_payloads = _load_fixtures()["valid"]
    job = deepcopy(fixture_payloads["job"])
    source_request = deepcopy(fixture_payloads["sourceExecutionRequest"])
    return job, source_request


def test_runtime_context_validates_and_correlates_execution_contracts() -> None:
    """Construct a context only when both payloads describe the same source job."""
    job, source_request = _runtime_payloads()
    context = load_runtime_context(
        worker_id=WORKER_ID,
        job_payload=job,
        source_request_payload=source_request,
    )

    assert context.worker_id == WORKER_ID
    assert context.job.id == context.source_request.jobId
    assert context.job.stepId == context.source_request.stepId


def test_runtime_context_rejects_invalid_or_mismatched_contracts() -> None:
    """Reject invalid payloads and separately valid payloads for different work."""
    job, source_request = _runtime_payloads()
    job["contractVersion"] = "v2"

    with pytest.raises(ValidationError):
        load_runtime_context(
            worker_id=WORKER_ID,
            job_payload=job,
            source_request_payload=source_request,
        )

    job, source_request = _runtime_payloads()
    source_request["stepId"] = "123e4567-e89b-12d3-a456-426614174099"
    with pytest.raises(ContractConsistencyError, match="stepId"):
        load_runtime_context(
            worker_id=WORKER_ID,
            job_payload=job,
            source_request_payload=source_request,
        )


def test_load_config_validates_worker_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Load a stable worker identity and reject invalid runtime configuration."""
    monkeypatch.setenv("WORKER_ID", str(WORKER_ID))
    monkeypatch.setenv("LOG_LEVEL", "debug")
    monkeypatch.setenv("PORT", "3030")

    config = load_config("worker", 3020)

    assert config.worker_id == WORKER_ID
    assert config.log_level == "debug"
    assert config.port == 3030

    monkeypatch.setenv("WORKER_ID", "not-a-uuid")
    with pytest.raises(ValueError, match="WORKER_ID"):
        load_config("worker", 3020)


def test_health_endpoint_reports_worker_identity() -> None:
    """Serve readiness information without exposing worker configuration values."""
    config = WorkerConfig(
        host="127.0.0.1",
        port=0,
        service_name="worker",
        worker_id=WORKER_ID,
        log_level="info",
    )
    server = create_server(config)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        port = server.server_address[1]
        with urlopen(f"http://127.0.0.1:{port}/health") as response:  # noqa: S310
            payload = json.loads(response.read())
    finally:
        server.shutdown()
        server.server_close()
        thread.join()

    assert payload == {"service": "worker", "status": "ok", "workerId": str(WORKER_ID)}


def test_structured_logs_redact_sensitive_context(capsys: pytest.CaptureFixture[str]) -> None:
    """Prevent credentials in nested configuration from entering worker logs."""
    write_log("info", "worker_started", configuration={"apiToken": "usable-secret"})

    output = capsys.readouterr().out
    assert "usable-secret" not in output
    assert "[REDACTED]" in output
