"""Tests for REST document acquisition, checkpoint candidates, and redaction."""

from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import URLError
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

import pytest

from workers.python.checkpoints import (
    CheckpointCandidate,
    CheckpointStore,
    CheckpointValue,
    SourceCheckpointLifecycle,
)
from workers.python.components.sources.rest_source import (
    RESTSource,
    RESTSourceError,
    redact_rest_request,
)
from workers.python.generated.source_execution_request import SourceExecutionRequest
from workers.python.storage import LocalDatasetStorage

PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
SOURCE_ID = UUID("00000000-0000-0000-0000-000000000005")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")


class FakeCheckpointStore(CheckpointStore):
    """Hold checkpoint candidates in memory so API pagination remains isolated in tests."""

    def __init__(self, current: CheckpointValue | None) -> None:
        """Set the checkpoint returned before REST acquisition starts."""
        self.current = current
        self.commits: list[CheckpointCandidate] = []

    def load(self, pipeline_id: UUID, source_component_id: UUID) -> CheckpointValue | None:
        """Return the current value while asserting ownership remains consistent."""
        assert (pipeline_id, source_component_id) == (PIPELINE_ID, SOURCE_ID)
        return self.current

    def commit_if_run_succeeded(
        self, candidate: CheckpointCandidate, run_id: UUID, *, now: datetime | None = None
    ) -> bool:
        """Capture the deferred candidate only after the test simulates run completion."""
        assert run_id == RUN_ID
        assert now == datetime(2026, 8, 13, 12, 0, tzinfo=UTC)
        self.commits.append(candidate)
        return True


class ScriptedTransport:
    """Capture outbound REST requests and return deterministic JSON response bytes."""

    def __init__(self, responses: list[bytes]) -> None:
        """Set the response payloads returned in request order."""
        self.responses = responses
        self.requests: list[tuple[str, dict[str, str]]] = []

    def __call__(self, url: str, headers: Mapping[str, str]) -> bytes:
        """Record one safe request shape and return the next response payload."""
        self.requests.append((url, dict(headers)))
        return self.responses.pop(0)


def source_request(
    values: dict[str, object], *, secret_bindings: list[dict[str, str]] | None = None
) -> SourceExecutionRequest:
    """Build a valid REST Source request with portable configuration and secret bindings."""
    return SourceExecutionRequest.model_validate(
        {
            "contractVersion": "v1",
            "jobId": "00000000-0000-0000-0000-000000000004",
            "pipelineId": str(PIPELINE_ID),
            "runId": str(RUN_ID),
            "stepId": "00000000-0000-0000-0000-000000000003",
            "componentId": str(SOURCE_ID),
            "componentType": "source.rest",
            "componentVersion": "v1",
            "configuration": {
                "values": values,
                "secretBindings": secret_bindings or [],
            },
        }
    )


def test_rest_source_paginates_documents_and_proposes_a_checkpoint_candidate(
    tmp_path: Path,
) -> None:
    """REST pages produce one document Dataset while only proposing the next checkpoint."""
    store = FakeCheckpointStore({"value": "watermark-0"})
    lifecycle = SourceCheckpointLifecycle(store, PIPELINE_ID, SOURCE_ID)
    transport = ScriptedTransport(
        [
            b'{"data":[{"id":1}],"paging":{"next":"cursor-2"},"meta":{"watermark":"watermark-1"}}',
            b'{"data":[{"id":2}],"paging":{"next":null},"meta":{"watermark":"watermark-2"}}',
        ]
    )
    storage = LocalDatasetStorage(tmp_path / "datasets")
    source = RESTSource(
        storage,
        secret_resolver=lambda binding: {"rest-api-token": "top-secret"}[binding],
        checkpoint_lifecycle=lifecycle,
        transport=transport,
    )

    descriptor = source(
        source_request(
            {
                "url": "https://api.example.test/v1",
                "path": "orders",
                "queryParams": {"status": "active"},
                "headers": {"X-Client": "PantaETL"},
                "nextPagePath": "paging.next",
                "pageParameter": "cursor",
                "checkpointPath": "meta.watermark",
                "checkpointParameter": "since",
            },
            secret_bindings=[{"key": "apiToken", "binding": "rest-api-token"}],
        )
    )

    assert storage.read_document(descriptor) == {
        "pages": [
            {
                "data": [{"id": 1}],
                "paging": {"next": "cursor-2"},
                "meta": {"watermark": "watermark-1"},
            },
            {"data": [{"id": 2}], "paging": {"next": None}, "meta": {"watermark": "watermark-2"}},
        ]
    }
    first_url, first_headers = transport.requests[0]
    second_url, second_headers = transport.requests[1]
    assert urlsplit(first_url).path == "/v1/orders"
    assert parse_qs(urlsplit(first_url).query) == {"status": ["active"], "since": ["watermark-0"]}
    assert parse_qs(urlsplit(second_url).query)["cursor"] == ["cursor-2"]
    assert (
        first_headers
        == second_headers
        == {
            "X-Client": "PantaETL",
            "Authorization": "Bearer top-secret",
        }
    )
    assert store.commits == []

    assert (
        lifecycle.commit_after_run_success(RUN_ID, now=datetime(2026, 8, 13, 12, 0, tzinfo=UTC))
        is True
    )
    assert store.commits[0].value == {"pageToken": None, "value": "watermark-2"}


def test_rest_source_redacts_secrets_and_fails_without_exposing_request_values(
    tmp_path: Path,
) -> None:
    """Diagnostics redact secret query/header values and failed requests do not reveal them."""
    redacted = redact_rest_request(
        "https://api.example.test/orders?api_key=private-key&status=active",
        {"Authorization": "Bearer top-secret", "X-Client": "PantaETL"},
    )
    assert redacted == {
        "url": "https://api.example.test/orders?api_key=%5BREDACTED%5D&status=active",
        "headers": {"Authorization": "[REDACTED]", "X-Client": "PantaETL"},
    }

    source = RESTSource(
        LocalDatasetStorage(tmp_path / "datasets"),
        secret_resolver=lambda _binding: "top-secret",
        transport=lambda _url, _headers: (_ for _ in ()).throw(URLError("not reachable")),
    )
    with pytest.raises(RESTSourceError, match="request failed") as error:
        source(
            source_request(
                {"url": "https://api.example.test/orders"},
                secret_bindings=[{"key": "apiToken", "binding": "rest-api-token"}],
            )
        )

    assert "top-secret" not in str(error.value)
    assert "rest-api-token" not in str(error.value)
