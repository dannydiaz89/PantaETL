"""REST API Source implementation with portable pagination and checkpoint hooks."""

import json
from collections.abc import Callable, Mapping
from datetime import UTC, datetime, timedelta
from typing import cast
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from ...checkpoints import CheckpointValue, SourceCheckpointLifecycle
from ...generated.component_metadata import ComponentMetadata
from ...generated.dataset_descriptor import DatasetDescriptor
from ...generated.source_execution_request import SecretBinding, SourceExecutionRequest
from ...registries import SourceRegistry
from ...storage import DatasetLifecycle, DatasetStorage, JsonDocument

_MAX_RESPONSE_BYTES = 10 * 1024 * 1024
_MAX_PAGES = 1_000
_REDACTED = "[REDACTED]"
_SENSITIVE_NAME_PARTS = (
    "api_key",
    "api-key",
    "authorization",
    "credential",
    "password",
    "secret",
    "token",
)

REST_SOURCE_METADATA = ComponentMetadata.model_validate(
    {
        "kind": "source",
        "type": "source.rest",
        "version": "v1",
        "displayNameKey": "components.sources.rest.name",
        "descriptionKey": "components.sources.rest.description",
        "configFields": [
            {
                "key": "url",
                "type": "text",
                "labelKey": "components.sources.rest.url",
                "required": True,
                "secret": False,
            },
            {
                "key": "path",
                "type": "text",
                "labelKey": "components.sources.rest.path",
                "required": False,
                "secret": False,
            },
            {
                "key": "queryParams",
                "type": "json",
                "labelKey": "components.sources.rest.queryParams",
                "required": False,
                "secret": False,
            },
            {
                "key": "headers",
                "type": "json",
                "labelKey": "components.sources.rest.headers",
                "required": False,
                "secret": False,
            },
            {
                "key": "apiToken",
                "type": "text",
                "labelKey": "components.sources.rest.apiToken",
                "required": False,
                "secret": True,
            },
            {
                "key": "authHeader",
                "type": "text",
                "labelKey": "components.sources.rest.authHeader",
                "required": False,
                "secret": False,
            },
            {
                "key": "authScheme",
                "type": "text",
                "labelKey": "components.sources.rest.authScheme",
                "required": False,
                "secret": False,
            },
            {
                "key": "nextPagePath",
                "type": "text",
                "labelKey": "components.sources.rest.nextPagePath",
                "required": False,
                "secret": False,
            },
            {
                "key": "pageParameter",
                "type": "text",
                "labelKey": "components.sources.rest.pageParameter",
                "required": False,
                "secret": False,
            },
            {
                "key": "checkpointPath",
                "type": "text",
                "labelKey": "components.sources.rest.checkpointPath",
                "required": False,
                "secret": False,
            },
            {
                "key": "checkpointParameter",
                "type": "text",
                "labelKey": "components.sources.rest.checkpointParameter",
                "required": False,
                "secret": False,
            },
            {
                "key": "maxPages",
                "type": "number",
                "labelKey": "components.sources.rest.maxPages",
                "required": False,
                "secret": False,
            },
        ],
        "inputFamilies": [],
        "outputFamilies": ["document"],
    }
)

type SecretResolver = Callable[[str], str]
type RESTTransport = Callable[[str, Mapping[str, str]], bytes]


class RESTSourceError(RuntimeError):
    """Raised when a REST response cannot be safely acquired or interpreted."""


class RESTSource:
    """Acquire JSON API responses, persisting pages and a deferred checkpoint candidate."""

    def __init__(
        self,
        storage: DatasetStorage,
        *,
        secret_resolver: SecretResolver | None = None,
        checkpoint_lifecycle: SourceCheckpointLifecycle | None = None,
        transport: RESTTransport | None = None,
        dataset_retention: timedelta = timedelta(days=1),
    ) -> None:
        """Bind storage and safe dependencies without retaining resolved secrets."""
        if dataset_retention <= timedelta():
            raise ValueError("Dataset retention must be positive.")
        self._storage = storage
        self._secret_resolver = secret_resolver
        self._checkpoint_lifecycle = checkpoint_lifecycle
        self._transport = transport or _default_transport
        self._dataset_retention = dataset_retention

    def __call__(self, request: SourceExecutionRequest) -> DatasetDescriptor:
        """Fetch configured pages, preserve them as a JSON document, and propose a checkpoint."""
        configuration = _RESTConfiguration.from_request(request)
        checkpoint = self._load_checkpoint()
        query_parameters = dict(configuration.query_parameters)
        _apply_checkpoint_query_parameters(query_parameters, configuration, checkpoint)
        headers = self._build_headers(request, configuration)

        pages: list[JsonDocument] = []
        checkpoint_value = checkpoint.get("value")
        page_token = _checkpoint_page_token(checkpoint)
        for _ in range(configuration.max_pages):
            if page_token is not None:
                query_parameters[configuration.page_token_parameter] = page_token
            url = _build_request_url(configuration.url, configuration.path, query_parameters)
            response = self._read_response(url, headers)
            pages.append(response)

            checkpoint_value = _response_checkpoint_value(response, configuration, checkpoint_value)
            page_token = _response_page_token(response, configuration)
            if page_token is None:
                break
        else:
            raise RESTSourceError("REST pagination exceeded the configured page limit.")

        self._propose_checkpoint(configuration, page_token, checkpoint_value)
        return self._storage.persist_document(
            {"pages": pages},
            DatasetLifecycle(
                pipeline_id=request.pipelineId,
                run_id=request.runId,
                step_id=request.stepId,
                expires_at=datetime.now(UTC) + self._dataset_retention,
            ),
        )

    def _load_checkpoint(self) -> dict[str, CheckpointValue]:
        if self._checkpoint_lifecycle is None:
            return {}
        checkpoint = self._checkpoint_lifecycle.load()
        if checkpoint is None:
            return {}
        if not isinstance(checkpoint, dict):
            raise RESTSourceError("REST checkpoint must be an object.")
        if any(key not in {"pageToken", "value"} for key in checkpoint):
            raise RESTSourceError("REST checkpoint has an unsupported shape.")
        return checkpoint

    def _build_headers(
        self, request: SourceExecutionRequest, configuration: "_RESTConfiguration"
    ) -> dict[str, str]:
        headers = dict(configuration.headers)
        binding = _binding_for_key(request.configuration.secretBindings, "apiToken")
        if binding is None:
            return headers
        if self._secret_resolver is None:
            raise RESTSourceError("REST source requires an assigned secret resolver.")
        token = self._secret_resolver(binding.binding)
        if not token:
            raise RESTSourceError("REST source secret could not be resolved.")
        headers[configuration.auth_header] = f"{configuration.auth_scheme} {token}".strip()
        return headers

    def _read_response(self, url: str, headers: Mapping[str, str]) -> JsonDocument:
        try:
            payload = self._transport(url, headers)
        except (HTTPError, URLError, OSError, TimeoutError) as error:
            raise RESTSourceError("REST source request failed.") from error
        if len(payload) > _MAX_RESPONSE_BYTES:
            raise RESTSourceError("REST source response exceeds the allowed size.")
        try:
            return cast(JsonDocument, json.loads(payload))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RESTSourceError("REST source response is not valid JSON.") from error

    def _propose_checkpoint(
        self,
        configuration: "_RESTConfiguration",
        page_token: str | None,
        checkpoint_value: CheckpointValue | None,
    ) -> None:
        if self._checkpoint_lifecycle is None:
            return
        if configuration.next_page_token_path is None and configuration.checkpoint_path is None:
            return
        self._checkpoint_lifecycle.propose({"pageToken": page_token, "value": checkpoint_value})


class _RESTConfiguration:
    """Validated execution-only REST settings extracted from portable request configuration."""

    def __init__(
        self,
        *,
        url: str,
        path: str | None,
        query_parameters: Mapping[str, str],
        headers: Mapping[str, str],
        auth_header: str,
        auth_scheme: str,
        next_page_token_path: tuple[str, ...] | None,
        page_token_parameter: str,
        checkpoint_path: tuple[str, ...] | None,
        checkpoint_parameter: str | None,
        max_pages: int,
    ) -> None:
        """Store fully validated REST settings without mutating request values."""
        self.url = url
        self.path = path
        self.query_parameters = query_parameters
        self.headers = headers
        self.auth_header = auth_header
        self.auth_scheme = auth_scheme
        self.next_page_token_path = next_page_token_path
        self.page_token_parameter = page_token_parameter
        self.checkpoint_path = checkpoint_path
        self.checkpoint_parameter = checkpoint_parameter
        self.max_pages = max_pages

    @classmethod
    def from_request(cls, request: SourceExecutionRequest) -> "_RESTConfiguration":
        """Validate JSON configuration values before network access begins."""
        values = request.configuration.values
        url = _required_text(values, "url")
        _validate_base_url(url)
        path = _optional_text(values, "path")
        _validate_relative_path(path)
        next_page_token_path = _optional_document_path(values, "nextPagePath")
        checkpoint_path = _optional_document_path(values, "checkpointPath")
        checkpoint_parameter = _optional_text(values, "checkpointParameter")
        if checkpoint_path is None and checkpoint_parameter is not None:
            raise RESTSourceError("REST checkpointParameter requires checkpointPath.")
        if checkpoint_path is not None and checkpoint_parameter is None:
            raise RESTSourceError("REST checkpointPath requires checkpointParameter.")
        return cls(
            url=url,
            path=path,
            query_parameters=_string_mapping(values, "queryParams"),
            headers=_header_mapping(values),
            auth_header=_optional_text(values, "authHeader") or "Authorization",
            auth_scheme=_optional_text(values, "authScheme") or "Bearer",
            next_page_token_path=next_page_token_path,
            page_token_parameter=_optional_text(values, "pageParameter") or "page",
            checkpoint_path=checkpoint_path,
            checkpoint_parameter=checkpoint_parameter,
            max_pages=_max_pages(values),
        )


def register_rest_source(registry: SourceRegistry, source: RESTSource) -> None:
    """Install the REST Source capability without coupling it to other Sources."""
    registry.register(REST_SOURCE_METADATA, source)


def redact_rest_request(url: str, headers: Mapping[str, str]) -> dict[str, object]:
    """Return diagnostic-safe request context with secret query and header values removed."""
    parsed = urlsplit(url)
    query = [
        (key, _REDACTED if _is_sensitive_name(key) else value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
    ]
    return {
        "url": urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), "")),
        "headers": {
            key: _REDACTED if _is_sensitive_name(key) else value for key, value in headers.items()
        },
    }


def _default_transport(url: str, headers: Mapping[str, str]) -> bytes:
    """Issue one bounded GET request without logging the URL, headers, or response body."""
    request = Request(url, headers=dict(headers), method="GET")
    with urlopen(request, timeout=30) as response:  # noqa: S310 - configured Sources own network access.
        return cast(bytes, response.read(_MAX_RESPONSE_BYTES + 1))


def _required_text(values: Mapping[str, object], key: str) -> str:
    value = _optional_text(values, key)
    if value is None:
        raise RESTSourceError(f"REST source requires {key} configuration.")
    return value


def _optional_text(values: Mapping[str, object], key: str) -> str | None:
    value = values.get(key)
    if value is None:
        return None
    value_root = getattr(value, "root", None)
    if not isinstance(value_root, str):
        raise RESTSourceError(f"REST {key} configuration must be text.")
    if not value_root.strip():
        raise RESTSourceError(f"REST {key} configuration must not be empty.")
    return value_root


def _string_mapping(values: Mapping[str, object], key: str) -> dict[str, str]:
    value = values.get(key)
    if value is None:
        return {}
    value_root = getattr(value, "root", None)
    if not isinstance(value_root, dict):
        raise RESTSourceError(f"REST {key} configuration must be an object.")
    result: dict[str, str] = {}
    for item_key, item_value in value_root.items():
        item_root = getattr(item_value, "root", item_value)
        if not isinstance(item_key, str) or not isinstance(item_root, str):
            raise RESTSourceError(f"REST {key} configuration must map text to text.")
        if not item_key or _is_sensitive_name(item_key):
            raise RESTSourceError(f"REST {key} configuration contains a protected key.")
        result[item_key] = item_root
    return result


def _header_mapping(values: Mapping[str, object]) -> dict[str, str]:
    headers = _string_mapping(values, "headers")
    if any(header.lower() in {"authorization", "cookie"} for header in headers):
        raise RESTSourceError("REST headers must not include protected authentication values.")
    return headers


def _optional_document_path(values: Mapping[str, object], key: str) -> tuple[str, ...] | None:
    value = _optional_text(values, key)
    if value is None:
        return None
    segments = tuple(value.split("."))
    if any(not segment.strip() for segment in segments):
        raise RESTSourceError(f"REST {key} configuration must be a dotted object path.")
    return segments


def _max_pages(values: Mapping[str, object]) -> int:
    value = values.get("maxPages")
    if value is None:
        return 100
    value_root = getattr(value, "root", None)
    if not isinstance(value_root, int) or isinstance(value_root, bool):
        raise RESTSourceError("REST maxPages configuration must be an integer.")
    if not 1 <= value_root <= _MAX_PAGES:
        raise RESTSourceError(f"REST maxPages must be between 1 and {_MAX_PAGES}.")
    return value_root


def _validate_base_url(url: str) -> None:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RESTSourceError("REST URL must use HTTP or HTTPS and include a host.")
    if parsed.username is not None or parsed.password is not None:
        raise RESTSourceError("REST URL must not include credentials.")
    if any(_is_sensitive_name(key) for key, _ in parse_qsl(parsed.query, keep_blank_values=True)):
        raise RESTSourceError("REST URL must not include sensitive query parameters.")


def _validate_relative_path(path: str | None) -> None:
    if path is None:
        return
    parsed = urlsplit(path)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
        raise RESTSourceError("REST path must be a relative path without query parameters.")
    if path.startswith("/") or ".." in path.split("/"):
        raise RESTSourceError("REST path must be a safe relative location.")


def _apply_checkpoint_query_parameters(
    query_parameters: dict[str, str],
    configuration: _RESTConfiguration,
    checkpoint: Mapping[str, CheckpointValue],
) -> None:
    if configuration.checkpoint_parameter is None:
        return
    value = checkpoint.get("value")
    if value is None:
        return
    if not isinstance(value, str | int | float | bool):
        raise RESTSourceError("REST checkpoint value must be a scalar.")
    query_parameters[configuration.checkpoint_parameter] = str(value).lower()


def _checkpoint_page_token(checkpoint: Mapping[str, CheckpointValue]) -> str | None:
    value = checkpoint.get("pageToken")
    if value is None:
        return None
    if not isinstance(value, str):
        raise RESTSourceError("REST page token checkpoint must be text.")
    return value


def _build_request_url(base_url: str, path: str | None, query_parameters: Mapping[str, str]) -> str:
    target = base_url if path is None else urljoin(f"{base_url.rstrip('/')}/", path)
    parsed = urlsplit(target)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update(query_parameters)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), ""))


def _response_page_token(response: JsonDocument, configuration: _RESTConfiguration) -> str | None:
    if configuration.next_page_token_path is None:
        return None
    token = _read_document_path(response, configuration.next_page_token_path)
    if token is None:
        return None
    if not isinstance(token, str):
        raise RESTSourceError("REST response page token must be text or null.")
    return token


def _response_checkpoint_value(
    response: JsonDocument,
    configuration: _RESTConfiguration,
    fallback: CheckpointValue | None,
) -> CheckpointValue | None:
    if configuration.checkpoint_path is None:
        return fallback
    value = _read_document_path(response, configuration.checkpoint_path)
    if not isinstance(value, str | int | float | bool | type(None)):
        raise RESTSourceError("REST response checkpoint value must be a scalar or null.")
    return value


def _read_document_path(document: JsonDocument, path: tuple[str, ...]) -> JsonDocument:
    value = document
    for segment in path:
        if not isinstance(value, dict) or segment not in value:
            raise RESTSourceError("REST response does not contain the configured path.")
        value = value[segment]
    return value


def _binding_for_key(bindings: list[SecretBinding], key: str) -> SecretBinding | None:
    matches = [binding for binding in bindings if binding.key == key]
    if len(matches) > 1:
        raise RESTSourceError("REST source has duplicate secret bindings.")
    return matches[0] if matches else None


def _is_sensitive_name(value: str) -> bool:
    normalized = value.replace("_", "-").lower()
    return any(part in normalized for part in _SENSITIVE_NAME_PARTS)
