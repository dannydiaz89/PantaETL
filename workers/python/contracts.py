"""Validated loaders for contracts crossing into the Python worker."""

from collections.abc import Mapping

from pydantic import BaseModel

from .generated import DatasetDescriptor, Job, Run, SourceExecutionRequest


def _load_contract[ContractModel: BaseModel](
    model: type[ContractModel], payload: Mapping[str, object]
) -> ContractModel:
    """Validate an untrusted wire payload with its generated Pydantic model."""
    return model.model_validate(payload)


def load_job(payload: Mapping[str, object]) -> Job:
    """Validate and load a Job payload received by the worker."""
    return _load_contract(Job, payload)


def load_source_execution_request(payload: Mapping[str, object]) -> SourceExecutionRequest:
    """Validate and load a Source execution request payload for a worker job."""
    return _load_contract(SourceExecutionRequest, payload)


def load_dataset_descriptor(payload: Mapping[str, object]) -> DatasetDescriptor:
    """Validate and load a temporary Dataset descriptor payload."""
    return _load_contract(DatasetDescriptor, payload)


def load_run(payload: Mapping[str, object]) -> Run:
    """Validate and load a Run payload used for execution result reporting."""
    return _load_contract(Run, payload)
