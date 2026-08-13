"""Execution of persisted linear pipeline graphs claimed from PostgreSQL."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from threading import Event
from typing import Literal, Protocol, cast
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from .artifacts import ArtifactPublisher, LocalArtifactStorage, PostgresArtifactMetadataStore
from .checkpoints import PostgresCheckpointStore, RunCheckpointCoordinator
from .components.exports.csv_artifact import CSVArtifactExport, register_csv_artifact_export
from .components.exports.postgres_export import PostgresExport, register_postgres_export
from .components.sources.csv_source import CSVSource, register_csv_source
from .components.sources.rest_source import RESTSource, register_rest_source
from .components.transforms.columns import register_column_transforms
from .components.transforms.document import register_document_transforms
from .config import WorkerConfig
from .generated.artifact_descriptor import ArtifactDescriptor
from .generated.dataset_descriptor import DatasetDescriptor
from .generated.job import Job
from .generated.source_execution_request import SourceExecutionRequest
from .job_queue import PostgresJobQueue, validate_database_url
from .observability import OperationalEvent, OperationalMetrics, PostgresOperationalEventStore
from .registries import ComponentConfiguration, ExportRegistry, SourceRegistry, TransformRegistry
from .service_logging import write_log
from .storage import DatasetStorage, LocalDatasetStorage

ComponentKind = Literal["source", "transform", "export"]


class PipelineExecutionError(RuntimeError):
    """Raised when persisted pipeline work cannot be executed safely."""


@dataclass(frozen=True, slots=True)
class PersistedPipelineComponent:
    """One persisted component joined to its run-step ownership row."""

    component_id: UUID
    component_type: str
    component_version: str
    configuration: ComponentConfiguration
    kind: ComponentKind
    step_id: UUID
    secret_bindings: tuple[dict[str, str], ...] = ()


@dataclass(frozen=True, slots=True)
class PipelineExecutionPlan:
    """A validated linear Source, Transform, Export plan for one claimed job."""

    components: tuple[PersistedPipelineComponent, ...]
    pipeline_id: UUID
    run_id: UUID


class JobExecutionQueue(Protocol):
    """Worker queue transitions needed around complete pipeline graph execution."""

    def claim_next(self, worker_id: UUID) -> Job | None:
        """Claim one due source job for the worker."""

    def fail(self, job_id: UUID, worker_id: UUID) -> Job | None:
        """Requeue or terminally fail a claimed job."""


class PipelineExecutionRepository(Protocol):
    """Persistence needed to execute and clean one scheduler-created pipeline run."""

    def load_plan(
        self, *, pipeline_id: UUID, run_id: UUID, source_component_id: UUID
    ) -> PipelineExecutionPlan:
        """Load the validated component chain for one claimed source job."""

    def start_run(self, pipeline_id: UUID, run_id: UUID, job_id: UUID, worker_id: UUID) -> None:
        """Record that the worker began a queued run."""

    def start_step(
        self,
        component: PersistedPipelineComponent,
        *,
        pipeline_id: UUID,
        run_id: UUID,
        job_id: UUID,
        worker_id: UUID,
    ) -> None:
        """Record that one run step is executing."""

    def record_dataset(self, descriptor: DatasetDescriptor, size_bytes: int) -> None:
        """Persist temporary Dataset ownership metadata."""

    def mark_step_succeeded(
        self,
        component: PersistedPipelineComponent,
        *,
        pipeline_id: UUID,
        run_id: UUID,
        job_id: UUID,
        worker_id: UUID,
        metrics: OperationalMetrics,
    ) -> None:
        """Record successful step completion and safe aggregate metrics."""

    def finish_success(
        self, pipeline_id: UUID, run_id: UUID, job_id: UUID, worker_id: UUID
    ) -> None:
        """Finish the worker-owned job and fully successful run."""

    def finish_failure(
        self, pipeline_id: UUID, run_id: UUID, component: PersistedPipelineComponent
    ) -> None:
        """Finish a run after its terminal source job failure."""

    def mark_cleanup_eligible(self, run_id: UUID) -> None:
        """Make temporary Dataset metadata immediately eligible for collection."""


class PostgresPipelineExecutionRepository:
    """Load a run graph and persist bounded lifecycle metadata through PostgreSQL."""

    def __init__(self, database_url: str) -> None:
        """Configure the repository without retaining an open transaction."""
        self._database_url = validate_database_url(database_url)

    def load_plan(
        self, *, pipeline_id: UUID, run_id: UUID, source_component_id: UUID
    ) -> PipelineExecutionPlan:
        """Read and validate the one linear graph anchored by the claimed Source."""
        with psycopg.connect(self._database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    _SELECT_RUN_COMPONENTS,
                    {"pipeline_id": pipeline_id, "run_id": run_id},
                )
                rows = cursor.fetchall()
                cursor.execute(_SELECT_PIPELINE_EDGES, {"pipeline_id": pipeline_id})
                edges = cursor.fetchall()

        components = tuple(_component_from_row(row) for row in rows)
        return _linear_plan(
            components,
            [
                (cast(UUID, edge["fromComponentId"]), cast(UUID, edge["toComponentId"]))
                for edge in edges
            ],
            pipeline_id,
            run_id,
            source_component_id,
        )

    def start_run(self, pipeline_id: UUID, run_id: UUID, job_id: UUID, worker_id: UUID) -> None:
        """Set a queued run running and record the one worker claim event."""
        now = datetime.now(UTC)
        with psycopg.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(_START_RUN_BY_ID, {"run_id": run_id, "now": now})
        events = PostgresOperationalEventStore(self._database_url)
        events.record(
            OperationalEvent(
                event="run_started",
                pipeline_id=pipeline_id,
                run_id=run_id,
                worker_id=worker_id,
            )
        )
        events.record(
            OperationalEvent(
                event="job_claimed",
                pipeline_id=pipeline_id,
                run_id=run_id,
                job_id=job_id,
                worker_id=worker_id,
            )
        )

    def start_step(
        self,
        component: PersistedPipelineComponent,
        *,
        pipeline_id: UUID,
        run_id: UUID,
        job_id: UUID,
        worker_id: UUID,
    ) -> None:
        """Mark the next persisted component step running before execution begins."""
        with psycopg.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(_START_STEP, {"run_step_id": component.step_id})
        PostgresOperationalEventStore(self._database_url).record(
            OperationalEvent(
                event="step_started",
                pipeline_id=pipeline_id,
                run_id=run_id,
                run_step_id=component.step_id,
                job_id=job_id,
                worker_id=worker_id,
            )
        )

    def mark_step_succeeded(
        self,
        component: PersistedPipelineComponent,
        *,
        pipeline_id: UUID,
        run_id: UUID,
        job_id: UUID,
        worker_id: UUID,
        metrics: OperationalMetrics,
    ) -> None:
        """Terminally record one completed component without writing record contents."""
        now = datetime.now(UTC)
        with psycopg.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(_SUCCEED_STEP, {"run_step_id": component.step_id, "now": now})
        PostgresOperationalEventStore(self._database_url).record(
            OperationalEvent(
                event="step_succeeded",
                pipeline_id=pipeline_id,
                run_id=run_id,
                run_step_id=component.step_id,
                job_id=job_id,
                worker_id=worker_id,
                metrics=metrics,
            )
        )

    def record_dataset(self, descriptor: DatasetDescriptor, size_bytes: int) -> None:
        """Persist explicit ownership metadata for a temporary stored Dataset."""
        if descriptor.storage.kind.value != "local":
            raise PipelineExecutionError("This worker only records local temporary datasets.")
        path = Path(descriptor.storage.location)
        if path.is_absolute() or ".." in path.parts:
            raise PipelineExecutionError("Temporary dataset storage location is unsafe.")
        if size_bytes < 0:
            raise PipelineExecutionError("Temporary dataset size cannot be negative.")
        with psycopg.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    _INSERT_DATASET,
                    {
                        "id": descriptor.id,
                        "pipeline_id": descriptor.pipelineId,
                        "run_id": descriptor.runId,
                        "run_step_id": descriptor.stepId,
                        "family": descriptor.family.value,
                        "format": descriptor.format,
                        "storage_kind": descriptor.storage.kind.value,
                        "storage_location": descriptor.storage.location,
                        "size_bytes": size_bytes,
                        "encrypted": descriptor.storage.encrypted,
                        "created_at": descriptor.createdAt,
                    },
                )

    def finish_success(
        self, pipeline_id: UUID, run_id: UUID, job_id: UUID, worker_id: UUID
    ) -> None:
        """Complete a claimed job and its run only after all component steps succeeded."""
        now = datetime.now(UTC)
        with psycopg.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    _SUCCEED_JOB,
                    {"job_id": job_id, "worker_id": worker_id, "now": now},
                )
                if cursor.rowcount != 1:
                    raise PipelineExecutionError("Worker no longer owns the active job.")
                cursor.execute(_SUCCEED_RUN, {"run_id": run_id, "now": now})
                if cursor.rowcount != 1:
                    raise PipelineExecutionError(
                        "Pipeline run cannot complete before all steps succeed."
                    )
        PostgresOperationalEventStore(self._database_url).record(
            OperationalEvent(
                event="run_succeeded",
                pipeline_id=pipeline_id,
                run_id=run_id,
                job_id=job_id,
                worker_id=worker_id,
            )
        )

    def finish_failure(
        self, pipeline_id: UUID, run_id: UUID, component: PersistedPipelineComponent
    ) -> None:
        """Mark the terminal source job and its owning run failed after retries end."""
        now = datetime.now(UTC)
        with psycopg.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(_FAIL_STEP, {"run_step_id": component.step_id, "now": now})
                cursor.execute(_FAIL_RUN, {"run_id": run_id, "now": now})
                cursor.execute(_EXPIRE_RUN_DATASETS, {"run_id": run_id, "now": now})
        PostgresOperationalEventStore(self._database_url).record(
            OperationalEvent(event="run_failed", pipeline_id=pipeline_id, run_id=run_id)
        )

    def mark_cleanup_eligible(self, run_id: UUID) -> None:
        """Make terminal-run Dataset metadata immediately eligible for retryable collection."""
        with psycopg.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(_EXPIRE_RUN_DATASETS, {"run_id": run_id, "now": datetime.now(UTC)})


class WorkerExecutionService:
    """Claim source jobs and execute their persisted linear component graph."""

    def __init__(
        self,
        *,
        database_url: str,
        datasets: DatasetStorage,
        exports: ExportRegistry,
        repository: PipelineExecutionRepository,
        sources: SourceRegistry,
        transforms: TransformRegistry,
        worker_id: UUID,
        checkpoints: RunCheckpointCoordinator | None = None,
        queue: JobExecutionQueue | None = None,
    ) -> None:
        """Bind only explicit worker execution dependencies and one worker identity."""
        self._datasets = datasets
        self._exports = exports
        self._queue: JobExecutionQueue = queue or PostgresJobQueue(database_url)
        self._repository = repository
        self._sources = sources
        self._transforms = transforms
        self._worker_id = worker_id
        self._checkpoints = checkpoints

    def run_once(self) -> bool:
        """Claim and execute one due source job, returning false when the queue is idle."""
        job = self._queue.claim_next(self._worker_id)
        if job is None:
            return False

        datasets: list[DatasetDescriptor] = []
        plan: PipelineExecutionPlan | None = None
        current: PersistedPipelineComponent | None = None
        try:
            plan = self._repository.load_plan(
                pipeline_id=job.pipelineId,
                run_id=job.runId,
                source_component_id=job.componentId,
            )
            self._repository.start_run(job.pipelineId, job.runId, job.id, self._worker_id)
            source = plan.components[0]
            current = source
            self._repository.start_step(
                source,
                pipeline_id=job.pipelineId,
                run_id=job.runId,
                job_id=job.id,
                worker_id=self._worker_id,
            )
            dataset = self._execute_source(source, job)
            datasets.append(dataset)
            self._repository.record_dataset(dataset, _dataset_size_bytes(self._datasets, dataset))
            self._repository.mark_step_succeeded(
                source,
                pipeline_id=job.pipelineId,
                run_id=job.runId,
                job_id=job.id,
                worker_id=self._worker_id,
                metrics=OperationalMetrics(),
            )

            for component in plan.components[1:]:
                current = component
                self._repository.start_step(
                    component,
                    pipeline_id=job.pipelineId,
                    run_id=job.runId,
                    job_id=job.id,
                    worker_id=self._worker_id,
                )
                if component.kind == "transform":
                    dataset = self._execute_transform(component, dataset)
                    datasets.append(dataset)
                    self._repository.record_dataset(
                        dataset, _dataset_size_bytes(self._datasets, dataset)
                    )
                    self._repository.mark_step_succeeded(
                        component,
                        pipeline_id=job.pipelineId,
                        run_id=job.runId,
                        job_id=job.id,
                        worker_id=self._worker_id,
                        metrics=OperationalMetrics(),
                    )
                    continue

                artifact = self._execute_export(component, dataset)
                self._repository.mark_step_succeeded(
                    component,
                    pipeline_id=job.pipelineId,
                    run_id=job.runId,
                    job_id=job.id,
                    worker_id=self._worker_id,
                    metrics=OperationalMetrics(
                        bytes_written=artifact.sizeBytes if artifact is not None else None,
                    ),
                )

            self._repository.finish_success(job.pipelineId, job.runId, job.id, self._worker_id)
            if self._checkpoints is not None:
                self._checkpoints.commit_after_run_success(job.runId)
            self._cleanup_datasets(job.runId, datasets)
            return True
        except Exception as error:
            self._handle_failure(job, current, datasets, error)
            return True

    def run_until_stopped(self, stopped: Event, poll_interval_seconds: float) -> None:
        """Poll for independently claimed work until the service receives shutdown."""
        while not stopped.is_set():
            if not self.run_once():
                stopped.wait(poll_interval_seconds)

    def _execute_source(self, component: PersistedPipelineComponent, job: Job) -> DatasetDescriptor:
        """Validate and execute one persisted Source without resolving secrets in the worker flow."""
        request = SourceExecutionRequest.model_validate(
            {
                "contractVersion": "v1",
                "jobId": job.id,
                "pipelineId": job.pipelineId,
                "runId": job.runId,
                "stepId": component.step_id,
                "componentId": component.component_id,
                "componentType": component.component_type,
                "componentVersion": component.component_version,
                "configuration": {
                    "values": component.configuration,
                    "secretBindings": list(component.secret_bindings),
                },
            }
        )
        registered = self._sources.resolve(component.component_type, component.component_version)
        self._sources.validate_configuration(
            component.component_type, component.component_version, component.configuration
        )
        return registered.executor(request)

    def _execute_transform(
        self, component: PersistedPipelineComponent, dataset: DatasetDescriptor
    ) -> DatasetDescriptor:
        """Apply a credential-free registered Transform and attribute output to its run step."""
        registered = self._transforms.resolve(component.component_type, component.component_version)
        self._transforms.validate_configuration(
            component.component_type, component.component_version, component.configuration
        )
        transformed = registered.executor(dataset, component.configuration)
        return transformed.model_copy(update={"stepId": component.step_id})

    def _execute_export(
        self, component: PersistedPipelineComponent, dataset: DatasetDescriptor
    ) -> ArtifactDescriptor | None:
        """Publish a retained artifact through the registered Export boundary."""
        registered = self._exports.resolve(component.component_type, component.component_version)
        self._exports.validate_configuration(
            component.component_type, component.component_version, component.configuration
        )
        return registered.executor(dataset, component.configuration)

    def _cleanup_datasets(self, run_id: UUID, datasets: list[DatasetDescriptor]) -> None:
        """Remove local temporary files and retain expiry metadata for idempotent GC retries."""
        self._repository.mark_cleanup_eligible(run_id)
        for descriptor in datasets:
            self._datasets.delete(descriptor)

    def _handle_failure(
        self,
        job: Job,
        current: PersistedPipelineComponent | None,
        datasets: list[DatasetDescriptor],
        error: Exception,
    ) -> None:
        """Release retryable work or terminally clean files without leaking data to logs."""
        if self._checkpoints is not None:
            self._checkpoints.discard_run(job.runId)
        failed_job = self._queue.fail(job.id, self._worker_id)
        if failed_job is not None and failed_job.state.value == "failed" and current is not None:
            self._repository.finish_failure(job.pipelineId, job.runId, current)
            self._cleanup_datasets(job.runId, datasets)
        write_log(
            "error",
            "pipeline_execution_failed",
            component=current.component_type if current is not None else "unknown",
            pipeline_id=job.pipelineId,
            run_id=job.runId,
            error=type(error).__name__,
        )


def create_execution_service(config: WorkerConfig) -> WorkerExecutionService:
    """Build the local-storage component set used by the worker process."""
    if not config.database_url:
        raise ValueError("DATABASE_URL is required for pipeline execution.")
    datasets = LocalDatasetStorage(config.storage_root)
    sources = SourceRegistry()
    transforms = TransformRegistry()
    exports = ExportRegistry()
    checkpoints = RunCheckpointCoordinator(PostgresCheckpointStore(config.database_url))
    register_csv_source(sources, CSVSource(datasets, config.source_input_root))
    register_rest_source(
        sources,
        RESTSource(datasets, checkpoint_lifecycle_factory=checkpoints.create_lifecycle),
    )
    register_column_transforms(transforms, datasets)
    register_document_transforms(transforms, datasets)
    publisher = ArtifactPublisher(
        LocalArtifactStorage(config.storage_root),
        PostgresArtifactMetadataStore(config.database_url),
    )
    register_csv_artifact_export(exports, CSVArtifactExport(datasets, publisher))
    register_postgres_export(exports, PostgresExport(datasets, config.database_url))
    return WorkerExecutionService(
        database_url=config.database_url,
        datasets=datasets,
        exports=exports,
        repository=PostgresPipelineExecutionRepository(config.database_url),
        sources=sources,
        transforms=transforms,
        worker_id=config.worker_id,
        checkpoints=checkpoints,
    )


def _component_from_row(row: Mapping[str, object]) -> PersistedPipelineComponent:
    """Validate the narrow database projection used to build one execution step."""
    kind = cast(ComponentKind, row["kind"])
    if kind not in {"source", "transform", "export"}:
        raise PipelineExecutionError("Pipeline component kind is invalid.")
    configuration = row["configurationValues"]
    if not isinstance(configuration, Mapping):
        raise PipelineExecutionError("Pipeline component configuration is invalid.")
    return PersistedPipelineComponent(
        component_id=cast(UUID, row["componentId"]),
        component_type=cast(str, row["componentType"]),
        component_version=cast(str, row["componentVersion"]),
        configuration=cast(ComponentConfiguration, dict(configuration)),
        kind=kind,
        step_id=cast(UUID, row["stepId"]),
        secret_bindings=_secret_bindings_from_row(row["secretBindings"]),
    )


def _secret_bindings_from_row(value: object) -> tuple[dict[str, str], ...]:
    """Validate persisted binding references without loading any secret values."""
    if not isinstance(value, list):
        raise PipelineExecutionError("Pipeline component secret bindings are invalid.")
    bindings: list[dict[str, str]] = []
    for binding in value:
        if not isinstance(binding, Mapping):
            raise PipelineExecutionError("Pipeline component secret bindings are invalid.")
        key = binding.get("key")
        reference = binding.get("binding")
        if not isinstance(key, str) or not key or not isinstance(reference, str) or not reference:
            raise PipelineExecutionError("Pipeline component secret bindings are invalid.")
        bindings.append({"key": key, "binding": reference})
    return tuple(bindings)


def _linear_plan(
    components: tuple[PersistedPipelineComponent, ...],
    edges: list[tuple[UUID, UUID]],
    pipeline_id: UUID,
    run_id: UUID,
    source_component_id: UUID,
) -> PipelineExecutionPlan:
    """Require exactly one Source-led linear chain for the initial integrated workflow."""
    by_id = {component.component_id: component for component in components}
    if source_component_id not in by_id or by_id[source_component_id].kind != "source":
        raise PipelineExecutionError("Claimed job does not belong to a persisted Source component.")
    outgoing: dict[UUID, UUID] = {}
    incoming: set[UUID] = set()
    for source, destination in edges:
        if (
            source not in by_id
            or destination not in by_id
            or source in outgoing
            or destination in incoming
        ):
            raise PipelineExecutionError(
                "Pipeline graph must be a linear chain for file execution."
            )
        outgoing[source] = destination
        incoming.add(destination)

    ordered: list[PersistedPipelineComponent] = []
    current = source_component_id
    while current in by_id:
        ordered.append(by_id[current])
        next_component = outgoing.get(current)
        if next_component is None:
            break
        current = next_component
    if (
        len(ordered) != len(components)
        or ordered[0].kind != "source"
        or ordered[-1].kind != "export"
        or any(component.kind != "transform" for component in ordered[1:-1])
    ):
        raise PipelineExecutionError(
            "Pipeline must contain one Source, optional Transforms, and one Export."
        )
    return PipelineExecutionPlan(tuple(ordered), pipeline_id, run_id)


_SELECT_RUN_COMPONENTS = """
SELECT
  pipeline_components.id AS "componentId",
  pipeline_components.kind::text AS kind,
  pipeline_components.component_type AS "componentType",
  pipeline_components.component_version AS "componentVersion",
  pipeline_components.configuration_values AS "configurationValues",
  pipeline_components.secret_bindings AS "secretBindings",
  run_steps.id AS "stepId"
FROM pipeline_components
INNER JOIN run_steps ON run_steps.component_id = pipeline_components.id
WHERE pipeline_components.pipeline_id = %(pipeline_id)s AND run_steps.run_id = %(run_id)s
ORDER BY run_steps.id
"""

_SELECT_PIPELINE_EDGES = """
SELECT from_component_id AS "fromComponentId", to_component_id AS "toComponentId"
FROM pipeline_edges
WHERE pipeline_id = %(pipeline_id)s
"""

_START_RUN_BY_ID = """
UPDATE runs SET state = 'running', started_at = COALESCE(started_at, %(now)s)
WHERE id = %(run_id)s AND state = 'queued'
"""

_START_STEP = """
UPDATE run_steps SET state = 'running', started_at = COALESCE(started_at, now())
WHERE id = %(run_step_id)s AND state = 'queued'
"""

_SUCCEED_STEP = """
UPDATE run_steps SET state = 'succeeded', completed_at = %(now)s
WHERE id = %(run_step_id)s AND state = 'running'
"""

_INSERT_DATASET = """
INSERT INTO datasets (
  id, pipeline_id, run_id, run_step_id, family, format, storage_kind,
  storage_location, size_bytes, encrypted, created_at, expires_at
) VALUES (
  %(id)s, %(pipeline_id)s, %(run_id)s, %(run_step_id)s, %(family)s, %(format)s,
  %(storage_kind)s::artifact_storage_kind, %(storage_location)s, %(size_bytes)s, %(encrypted)s,
  %(created_at)s, NULL
)
"""

_SUCCEED_JOB = """
UPDATE jobs SET state = 'succeeded', completed_at = %(now)s, worker_id = NULL,
  heartbeat_at = NULL
WHERE id = %(job_id)s AND worker_id = %(worker_id)s AND state = 'running'
"""

_SUCCEED_RUN = """
UPDATE runs SET state = 'succeeded', completed_at = %(now)s
WHERE id = %(run_id)s AND state = 'running'
  AND NOT EXISTS (SELECT 1 FROM run_steps WHERE run_id = %(run_id)s AND state != 'succeeded')
"""

_FAIL_STEP = """
UPDATE run_steps SET state = 'failed', completed_at = %(now)s
WHERE id = %(run_step_id)s AND state IN ('queued', 'running')
"""

_FAIL_RUN = """
UPDATE runs SET state = 'failed', completed_at = %(now)s
WHERE id = %(run_id)s AND state IN ('queued', 'running')
"""

_EXPIRE_RUN_DATASETS = """
UPDATE datasets SET expires_at = %(now)s WHERE run_id = %(run_id)s
"""


def _dataset_size_bytes(storage: DatasetStorage, descriptor: DatasetDescriptor) -> int:
    """Read the stored local byte count before terminal cleanup removes the temporary file."""
    try:
        return storage.size_bytes(descriptor)
    except Exception as error:
        raise PipelineExecutionError("Temporary dataset storage is unavailable.") from error
