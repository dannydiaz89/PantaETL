"""Scheduled REST pipeline integration through the normal worker execution lifecycle."""

from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from workers.python.checkpoints import (
    CheckpointCandidate,
    CheckpointStore,
    CheckpointValue,
    RunCheckpointCoordinator,
)
from workers.python.components.exports.postgres_export import (
    PostgresExport,
    register_postgres_export,
)
from workers.python.components.sources.rest_source import RESTSource, register_rest_source
from workers.python.components.transforms.document import register_document_transforms
from workers.python.execution import (
    PersistedPipelineComponent,
    PipelineExecutionPlan,
    WorkerExecutionService,
)
from workers.python.generated.dataset_descriptor import DatasetDescriptor
from workers.python.generated.job import Job
from workers.python.registries import ExportRegistry, SourceRegistry, TransformRegistry
from workers.python.storage import LocalDatasetStorage

PIPELINE_ID = UUID("323e4567-e89b-12d3-a456-426614174301")
RUN_ID = UUID("323e4567-e89b-12d3-a456-426614174302")
SOURCE_ID = UUID("323e4567-e89b-12d3-a456-426614174303")
TRANSFORM_ID = UUID("323e4567-e89b-12d3-a456-426614174304")
EXPORT_ID = UUID("323e4567-e89b-12d3-a456-426614174305")
SOURCE_STEP_ID = UUID("323e4567-e89b-12d3-a456-426614174306")
TRANSFORM_STEP_ID = UUID("323e4567-e89b-12d3-a456-426614174307")
EXPORT_STEP_ID = UUID("323e4567-e89b-12d3-a456-426614174308")
JOB_ID = UUID("323e4567-e89b-12d3-a456-426614174309")
WORKER_ID = UUID("323e4567-e89b-12d3-a456-426614174310")


class RecordingCheckpointStore(CheckpointStore):
    """Capture checkpoint commits without pretending a failed run completed."""

    def __init__(self) -> None:
        """Start with no prior REST watermark and no durable updates."""
        self.commits: list[CheckpointCandidate] = []

    def load(self, _pipeline_id: UUID, _source_component_id: UUID) -> CheckpointValue | None:
        """Return no prior watermark for the representative first scheduled run."""
        return None

    def commit_if_run_succeeded(
        self, candidate: CheckpointCandidate, run_id: UUID, *, now: datetime | None = None
    ) -> bool:
        """Record only candidates submitted after worker terminal success."""
        assert run_id == RUN_ID
        assert now is None
        self.commits.append(candidate)
        return True


class ScheduledJobQueue:
    """Expose one source job created by the scheduler's normal queue boundary."""

    def __init__(self) -> None:
        """Create one claimed source job and retain failure transition evidence."""
        self.job: Job | None = _scheduled_source_job()
        self.failures = 0

    def claim_next(self, worker_id: UUID) -> Job | None:
        """Return the due scheduled source job to its assigned worker."""
        assert worker_id == WORKER_ID
        job = self.job
        self.job = None
        return job

    def fail(self, job_id: UUID, worker_id: UUID) -> Job:
        """Return a terminal failed job after a non-retryable output failure."""
        assert (job_id, worker_id) == (JOB_ID, WORKER_ID)
        self.failures += 1
        return _scheduled_source_job(state="failed")


class RecordingRepository:
    """Record the persisted execution lifecycle used by scheduled worker jobs."""

    def __init__(self, plan: PipelineExecutionPlan) -> None:
        """Bind the exact REST-to-PostgreSQL component graph to the claimed run."""
        self.plan = plan
        self.finished = False
        self.failed = False
        self.datasets: list[DatasetDescriptor] = []

    def load_plan(self, **_kwargs: object) -> PipelineExecutionPlan:
        """Return scheduler-persisted graph data through the worker repository port."""
        return self.plan

    def start_run(self, *_args: object) -> None:
        """Accept the persisted queued-to-running transition."""

    def start_step(self, *_args: object, **_kwargs: object) -> None:
        """Accept each persisted component step start."""

    def record_dataset(self, descriptor: DatasetDescriptor, _size_bytes: int) -> None:
        """Collect temporary Dataset ownership metadata before cleanup."""
        self.datasets.append(descriptor)

    def mark_step_succeeded(self, *_args: object, **_kwargs: object) -> None:
        """Accept successful component transitions without retaining record contents."""

    def finish_success(self, *_args: object) -> None:
        """Record that the complete scheduled pipeline reached terminal success."""
        self.finished = True

    def finish_failure(self, *_args: object) -> None:
        """Record terminal failure once the queue cannot retry the source job."""
        self.failed = True

    def mark_cleanup_eligible(self, _run_id: UUID) -> None:
        """Accept cleanup eligibility after a terminal lifecycle transition."""


class RecordingCursor:
    """Capture parameterized PostgreSQL export work without a database test shortcut."""

    def __init__(self, fail: bool) -> None:
        """Choose whether the target-delivery statement fails transactionally."""
        self._fail = fail
        self.rows: list[tuple[object, ...]] = []

    def __enter__(self) -> "RecordingCursor":
        """Open the destination cursor."""
        return self

    def __exit__(self, *_args: object) -> None:
        """Close the destination cursor."""

    def execute(self, query: str) -> None:
        """Fail only target delivery after staging has exercised the full export path."""
        if self._fail and query.startswith('TRUNCATE TABLE "reporting"."orders"'):
            raise RuntimeError("destination unavailable")

    def executemany(self, _query: str, parameters: Iterable[tuple[object, ...]]) -> None:
        """Consume parameterized staged rows as a PostgreSQL driver would."""
        self.rows.extend(parameters)


class RecordingConnection:
    """Model commit-on-success and rollback-on-error destination behavior."""

    def __init__(self, cursor: RecordingCursor) -> None:
        """Bind the cursor used by this one export transaction."""
        self.cursor_value = cursor
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> "RecordingConnection":
        """Open the destination transaction."""
        return self

    def __exit__(self, exc_type: object, *_args: object) -> None:
        """Commit only successful destination delivery."""
        self.committed = exc_type is None
        self.rolled_back = exc_type is not None

    def cursor(self) -> RecordingCursor:
        """Return the transaction's destination cursor."""
        return self.cursor_value


def test_scheduled_rest_pipeline_commits_checkpoint_after_postgres_export(tmp_path: Path) -> None:
    """A scheduled REST Source advances its watermark only after complete delivery."""
    store = RecordingCheckpointStore()
    connection = RecordingConnection(RecordingCursor(fail=False))
    service, repository, queue = _scheduled_service(tmp_path, store, connection)

    assert service.run_once() is True
    assert repository.finished is True
    assert repository.failed is False
    assert queue.failures == 0
    assert connection.committed is True
    assert store.commits[0].value == {"pageToken": None, "value": "watermark-1"}
    assert len(connection.cursor_value.rows) == 1


def test_scheduled_rest_pipeline_discards_checkpoint_when_postgres_export_fails(
    tmp_path: Path,
) -> None:
    """A failed Export rolls back output and leaves the REST checkpoint unchanged."""
    store = RecordingCheckpointStore()
    connection = RecordingConnection(RecordingCursor(fail=True))
    service, repository, queue = _scheduled_service(tmp_path, store, connection)

    assert service.run_once() is True
    assert repository.finished is False
    assert repository.failed is True
    assert queue.failures == 1
    assert connection.rolled_back is True
    assert store.commits == []


def _scheduled_service(
    tmp_path: Path,
    store: RecordingCheckpointStore,
    connection: RecordingConnection,
) -> tuple[WorkerExecutionService, RecordingRepository, ScheduledJobQueue]:
    """Build the registered REST, document-transform, PostgreSQL scheduled workflow."""
    datasets = LocalDatasetStorage(tmp_path / "storage")
    sources = SourceRegistry()
    transforms = TransformRegistry()
    exports = ExportRegistry()
    checkpoints = RunCheckpointCoordinator(store)
    register_rest_source(
        sources,
        RESTSource(
            datasets,
            checkpoint_lifecycle_factory=checkpoints.create_lifecycle,
            transport=lambda _url, _headers: b'{"order_id":1,"total":12,"watermark":"watermark-1"}',
        ),
    )
    register_document_transforms(transforms, datasets)
    register_postgres_export(
        exports,
        PostgresExport(
            datasets,
            "postgresql://worker:password@localhost:5432/destination",
            connection_factory=lambda _url: connection,
        ),
    )
    plan = PipelineExecutionPlan(
        components=(
            PersistedPipelineComponent(
                component_id=SOURCE_ID,
                component_type="source.rest",
                component_version="v1",
                configuration={
                    "url": "https://api.example.test",
                    "checkpointPath": "watermark",
                    "checkpointParameter": "since",
                },
                kind="source",
                step_id=SOURCE_STEP_ID,
            ),
            PersistedPipelineComponent(
                component_id=TRANSFORM_ID,
                component_type="transform.document.flatten",
                component_version="v1",
                configuration={"record_path": ["pages"]},
                kind="transform",
                step_id=TRANSFORM_STEP_ID,
            ),
            PersistedPipelineComponent(
                component_id=EXPORT_ID,
                component_type="export.postgres",
                component_version="v1",
                configuration={"targetTable": "reporting.orders", "writeMode": "replace"},
                kind="export",
                step_id=EXPORT_STEP_ID,
            ),
        ),
        pipeline_id=PIPELINE_ID,
        run_id=RUN_ID,
    )
    repository = RecordingRepository(plan)
    queue = ScheduledJobQueue()
    return (
        WorkerExecutionService(
            database_url="postgresql://worker:password@localhost:5432/pantaetl",
            datasets=datasets,
            exports=exports,
            repository=repository,
            sources=sources,
            transforms=transforms,
            worker_id=WORKER_ID,
            checkpoints=checkpoints,
            queue=queue,
        ),
        repository,
        queue,
    )


def _scheduled_source_job(state: str = "running") -> Job:
    """Build the source job a due schedule makes available to the worker."""
    now = datetime.now(UTC)
    return Job.model_validate(
        {
            "contractVersion": "v1",
            "id": JOB_ID,
            "pipelineId": PIPELINE_ID,
            "runId": RUN_ID,
            "stepId": SOURCE_STEP_ID,
            "componentId": SOURCE_ID,
            "state": state,
            "attempt": 1,
            "retryPolicy": {"maxAttempts": 1, "retryDelaySeconds": 0},
            "availableAt": now,
            "claim": {"workerId": WORKER_ID, "claimedAt": now, "heartbeatAt": now},
        }
    )
