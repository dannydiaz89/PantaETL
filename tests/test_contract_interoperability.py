"""Verify Python accepts and rejects the same representative wire payloads as Zod."""

import json
from copy import deepcopy
from pathlib import Path
from typing import cast

import pytest
from pydantic import BaseModel, ValidationError

from workers.python.generated import DatasetDescriptor, Job, Run, SourceExecutionRequest

FixtureSections = dict[str, dict[str, dict[str, object]]]


def load_fixtures() -> FixtureSections:
    """Load the shared TypeScript/Python interoperability fixture document."""
    fixture_path = Path(__file__).parent / "fixtures" / "contract-interoperability.json"
    return cast(FixtureSections, json.loads(fixture_path.read_text(encoding="utf-8")))


MODELS: dict[str, type[BaseModel]] = {
    "dataset": DatasetDescriptor,
    "job": Job,
    "sourceExecutionRequest": SourceExecutionRequest,
    "run": Run,
}


def test_valid_contract_payloads_validate_in_python() -> None:
    """Accept representative Dataset, Job, Source request, and Run result payloads."""
    valid_payloads = load_fixtures()["valid"]

    for name, model in MODELS.items():
        model.model_validate(valid_payloads[name])


def test_unsupported_contract_versions_fail_in_python() -> None:
    """Reject the same unsupported wire version rejected by the Zod contracts."""
    invalid_payloads = load_fixtures()["invalid"]

    for name, model in MODELS.items():
        with pytest.raises(ValidationError):
            model.model_validate(invalid_payloads[name])


def test_inline_secret_configuration_is_rejected_in_python() -> None:
    """Require secret bindings instead of credential-shaped configuration keys."""
    source_request = deepcopy(load_fixtures()["valid"]["sourceExecutionRequest"])
    configuration = source_request["configuration"]
    assert isinstance(configuration, dict)
    values = configuration["values"]
    assert isinstance(values, dict)
    values["API_TOKEN"] = "usable-secret"

    with pytest.raises(ValidationError):
        SourceExecutionRequest.model_validate(source_request)
