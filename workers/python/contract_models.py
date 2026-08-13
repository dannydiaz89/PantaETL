"""Thin Pydantic models used to prove the cross-service wire contract boundary."""

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator, model_validator

ContractVersion = Literal["v1"]
DataFamily = Literal["any", "document", "tabular", "file"]
JobState = Literal["queued", "running", "succeeded", "failed", "cancelled"]
RunState = Literal[
    "queued",
    "running",
    "succeeded",
    "completed_with_warnings",
    "failed",
    "cancelled",
]


class ContractModel(BaseModel):
    """Base model that rejects fields absent from the canonical wire contract."""

    model_config = ConfigDict(extra="forbid")


def _require_timezone(value: datetime) -> datetime:
    """Reject naive timestamps because wire timestamps always carry an offset."""
    if value.tzinfo is None:
        raise ValueError("Timestamp must include an offset.")

    return value


class StorageDescriptor(ContractModel):
    """Credential-free location metadata for internal stored data."""

    kind: Literal["local", "s3"]
    location: Annotated[str, Field(min_length=1)]
    encrypted: bool


class DataStructureField(ContractModel):
    """Optional metadata describing one declared or inferred data field."""

    name: Annotated[str, Field(min_length=1)]
    type: Annotated[str, Field(min_length=1)]
    nullable: bool | None = None


class DataStructure(ContractModel):
    """Optional structure metadata that applies to any supported Dataset family."""

    format: Annotated[str, Field(min_length=1)]
    fields: list[DataStructureField] | None = None
    metadata: dict[str, JsonValue] | None = None


class DatasetContract(ContractModel):
    """Temporary execution Dataset descriptor accepted by the Python worker."""

    contract_version: ContractVersion = Field(alias="contractVersion")
    id: UUID
    family: DataFamily
    format: Annotated[str, Field(min_length=1)]
    storage: StorageDescriptor
    structure: DataStructure | None = None
    pipeline_id: UUID = Field(alias="pipelineId")
    run_id: UUID = Field(alias="runId")
    step_id: UUID = Field(alias="stepId")
    created_at: datetime = Field(alias="createdAt")
    expires_at: datetime = Field(alias="expiresAt")

    _validate_created_at = field_validator("created_at")(_require_timezone)
    _validate_expires_at = field_validator("expires_at")(_require_timezone)


class RetryPolicy(ContractModel):
    """Retry limits and delay metadata supplied with a queue job."""

    max_attempts: Annotated[int, Field(alias="maxAttempts", gt=0)]
    retry_delay_seconds: Annotated[int, Field(alias="retryDelaySeconds", ge=0)]


class WorkerClaim(ContractModel):
    """Worker claim and heartbeat metadata for a running job."""

    worker_id: UUID = Field(alias="workerId")
    claimed_at: datetime = Field(alias="claimedAt")
    heartbeat_at: datetime = Field(alias="heartbeatAt")

    _validate_claimed_at = field_validator("claimed_at")(_require_timezone)
    _validate_heartbeat_at = field_validator("heartbeat_at")(_require_timezone)


class CancellationRequest(ContractModel):
    """Cancellation signal metadata safe to share with execution services."""

    requested_at: datetime = Field(alias="requestedAt")
    requested_by_user_id: UUID | None = Field(default=None, alias="requestedByUserId")

    _validate_requested_at = field_validator("requested_at")(_require_timezone)


class JobContract(ContractModel):
    """Queue job payload validated by the worker before processing begins."""

    contract_version: ContractVersion = Field(alias="contractVersion")
    id: UUID
    pipeline_id: UUID = Field(alias="pipelineId")
    run_id: UUID = Field(alias="runId")
    step_id: UUID = Field(alias="stepId")
    component_id: UUID = Field(alias="componentId")
    state: JobState
    attempt: Annotated[int, Field(ge=0)]
    retry_policy: RetryPolicy = Field(alias="retryPolicy")
    available_at: datetime = Field(alias="availableAt")
    claim: WorkerClaim | None = None
    cancellation: CancellationRequest | None = None
    completed_at: datetime | None = Field(default=None, alias="completedAt")

    _validate_available_at = field_validator("available_at")(_require_timezone)


class SecretBinding(ContractModel):
    """Reference to a secret re-bound in the worker's execution environment."""

    key: Annotated[str, Field(min_length=1)]
    binding: Annotated[str, Field(min_length=1)]


def _contains_sensitive_key(value: JsonValue) -> bool:
    """Identify credential-like keys that cannot appear in portable config values."""
    sensitive_fragments = (
        "api_key",
        "apikey",
        "authorization",
        "credential",
        "password",
        "secret",
        "token",
    )

    if isinstance(value, Mapping):
        for key, nested_value in value.items():
            normalized_key = key.replace("-", "_").lower()
            if any(fragment in normalized_key for fragment in sensitive_fragments):
                return True
            if _contains_sensitive_key(nested_value):
                return True
        return False

    if isinstance(value, Sequence) and not isinstance(value, str):
        return any(_contains_sensitive_key(item) for item in value)

    return False


class ComponentConfiguration(ContractModel):
    """Portable component values plus secret binding references."""

    values: dict[str, JsonValue]
    secret_bindings: list[SecretBinding] = Field(alias="secretBindings")

    @model_validator(mode="after")
    def reject_inline_secrets(self) -> "ComponentConfiguration":
        """Require secret bindings instead of credential-shaped configuration keys."""
        if _contains_sensitive_key(self.values):
            raise ValueError("Portable configuration must use secretBindings for secret fields.")

        return self


class SourceExecutionRequest(ContractModel):
    """Source step request received by the worker without usable credentials."""

    contract_version: ContractVersion = Field(alias="contractVersion")
    job_id: UUID = Field(alias="jobId")
    pipeline_id: UUID = Field(alias="pipelineId")
    run_id: UUID = Field(alias="runId")
    step_id: UUID = Field(alias="stepId")
    component_id: UUID = Field(alias="componentId")
    component_type: Annotated[str, Field(alias="componentType", pattern=r"^source\.")]
    component_version: Annotated[str, Field(alias="componentVersion", pattern=r"^v\d+$")]
    configuration: ComponentConfiguration


class ExecutionMetrics(ContractModel):
    """Safe counters included with a completed execution step."""

    records_read: Annotated[int | None, Field(default=None, alias="recordsRead", ge=0)]
    records_written: Annotated[int | None, Field(default=None, alias="recordsWritten", ge=0)]
    bytes_read: Annotated[int | None, Field(default=None, alias="bytesRead", ge=0)]
    bytes_written: Annotated[int | None, Field(default=None, alias="bytesWritten", ge=0)]
    duration_milliseconds: Annotated[
        int | None, Field(default=None, alias="durationMilliseconds", ge=0)
    ]


class RunStepResult(ContractModel):
    """Result summary for one Source, Transform, or Export step."""

    step_id: UUID = Field(alias="stepId")
    component_id: UUID = Field(alias="componentId")
    state: RunState
    started_at: datetime | None = Field(default=None, alias="startedAt")
    completed_at: datetime | None = Field(default=None, alias="completedAt")
    warning_count: Annotated[int, Field(alias="warningCount", ge=0)]
    metrics: ExecutionMetrics


class RunResult(ContractModel):
    """Pipeline run result summary returned across the control-plane boundary."""

    contract_version: ContractVersion = Field(alias="contractVersion")
    id: UUID
    pipeline_id: UUID = Field(alias="pipelineId")
    state: RunState
    created_at: datetime = Field(alias="createdAt")
    started_at: datetime | None = Field(default=None, alias="startedAt")
    completed_at: datetime | None = Field(default=None, alias="completedAt")
    cancellation_requested_at: datetime | None = Field(
        default=None, alias="cancellationRequestedAt"
    )
    warning_count: Annotated[int, Field(alias="warningCount", ge=0)]
    steps: list[RunStepResult]

    _validate_created_at = field_validator("created_at")(_require_timezone)
