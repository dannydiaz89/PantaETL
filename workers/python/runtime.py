"""Worker runtime context built from validated execution contracts."""

from collections.abc import Mapping
from dataclasses import dataclass
from uuid import UUID

from .contracts import load_job, load_source_execution_request
from .generated import Job, SourceExecutionRequest


class ContractConsistencyError(ValueError):
    """Raised when independently valid worker contracts describe different work."""


@dataclass(frozen=True, slots=True)
class WorkerRuntimeContext:
    """Identity and validated contracts required to begin a Source job execution.

    The context deliberately exposes secret bindings rather than resolved secret
    values. A future Source executor can resolve only the bindings it is assigned.
    """

    worker_id: UUID
    job: Job
    source_request: SourceExecutionRequest


def load_runtime_context(
    *,
    worker_id: UUID,
    job_payload: Mapping[str, object],
    source_request_payload: Mapping[str, object],
) -> WorkerRuntimeContext:
    """Validate related job payloads and ensure they refer to the same source step."""
    job = load_job(job_payload)
    source_request = load_source_execution_request(source_request_payload)

    related_identifiers = {
        "jobId": (job.id, source_request.jobId),
        "pipelineId": (job.pipelineId, source_request.pipelineId),
        "runId": (job.runId, source_request.runId),
        "stepId": (job.stepId, source_request.stepId),
        "componentId": (job.componentId, source_request.componentId),
    }
    mismatched_fields = [
        name
        for name, (job_value, request_value) in related_identifiers.items()
        if job_value != request_value
    ]
    if mismatched_fields:
        fields = ", ".join(mismatched_fields)
        raise ContractConsistencyError(f"Worker contracts disagree on: {fields}.")

    return WorkerRuntimeContext(
        worker_id=worker_id,
        job=job,
        source_request=source_request,
    )
