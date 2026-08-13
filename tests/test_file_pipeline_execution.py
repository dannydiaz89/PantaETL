"""Representative file pipeline execution through registries, storage, and job lifecycle ports."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

from workers.python.artifacts import ArtifactPublisher, LocalArtifactStorage
from workers.python.components.exports.csv_artifact import (
    CSVArtifactExport,
    register_csv_artifact_export,
)
from workers.python.components.sources.csv_source import CSVSource, register_csv_source
from workers.python.components.transforms.columns import register_column_transforms
from workers.python.execution import (
    PersistedPipelineComponent,
    PipelineExecutionPlan,
    WorkerExecutionService,
)
from workers.python.generated.artifact_descriptor import ArtifactDescriptor
from workers.python.generated.dataset_descriptor import DatasetDescriptor
from workers.python.generated.job import Job
from workers.python.registries import ExportRegistry, SourceRegistry, TransformRegistry
from workers.python.storage import LocalDatasetStorage

PIPELINE_ID = UUID("123e4567-e89b-12d3-a456-426614174301")
RUN_ID = UUID("123e4567-e89b-12d3-a456-426614174302")
SOURCE_ID = UUID("123e4567-e89b-12d3-a456-426614174303")
TRANSFORM_ID = UUID("123e4567-e89b-12d3-a456-426614174304")
EXPORT_ID = UUID("123e4567-e89b-12d3-a456-426614174305")
SOURCE_STEP_ID = UUID("123e4567-e89b-12d3-a456-426614174306")
TRANSFORM_STEP_ID = UUID("123e4567-e89b-12d3-a456-426614174307")
EXPORT_STEP_ID = UUID("123e4567-e89b-12d3-a456-426614174308")
JOB_ID = UUID("123e4567-e89b-12d3-a456-426614174309")
WORKER_ID = UUID("123e4567-e89b-12d3-a456-426614174310")


class RecordingArtifactMetadata:
    """Collect finalized artifacts as the durable metadata boundary would."""

    def __init__(self) -> None:
        """Start without persisted retained output metadata."""
        self.descriptors: list[ArtifactDescriptor] = []

    def record(self, descriptor: ArtifactDescriptor) -> None:
        """Record only the artifact descriptor after finalization."""
        self.descriptors.append(descriptor)


class ClaimedJobQueue:
    """Expose one already-claimed scheduler job to the worker execution boundary."""

    def __init__(self, job: Job) -> None:
        """Configure the single source job generated for the run."""
        self.job: Job | None = job
        self.failed = False

    def claim_next(self, worker_id: UUID) -> Job | None:
        """Return the queued job only to its persisted worker identity."""
        assert worker_id == WORKER_ID
        job = self.job
        self.job = None
        return job

    def fail(self, job_id: UUID, worker_id: UUID) -> Job | None:
        """Fail the test if a successful file flow tries to requeue work."""
        assert job_id == JOB_ID
        assert worker_id == WORKER_ID
        self.failed = True
        return None


class RecordingExecutionRepository:
    """Exercise all persisted worker lifecycle calls without a test-only execution shortcut."""

    def __init__(self, plan: PipelineExecutionPlan) -> None:
        """Bind the exact graph scheduler persisted for this source job."""
        self.plan = plan
        self.datasets: list[DatasetDescriptor] = []
        self.dataset_sizes: list[int] = []
        self.started_steps: list[UUID] = []
        self.succeeded_steps: list[UUID] = []
        self.cleanup_run_ids: list[UUID] = []
        self.finished = False

    def load_plan(self, **_kwargs: object) -> PipelineExecutionPlan:
        """Return the validated run plan read through the repository boundary."""
        return self.plan

    def start_run(self, *_args: object) -> None:
        """Record that the queued run entered worker execution."""

    def start_step(self, component: PersistedPipelineComponent, **_kwargs: object) -> None:
        """Record each component execution transition."""
        self.started_steps.append(component.step_id)

    def record_dataset(self, descriptor: DatasetDescriptor, _size_bytes: int) -> None:
        """Capture explicit temporary dataset ownership metadata."""
        self.datasets.append(descriptor)
        self.dataset_sizes.append(_size_bytes)

    def mark_step_succeeded(self, component: PersistedPipelineComponent, **_kwargs: object) -> None:
        """Record the successful component transition."""
        self.succeeded_steps.append(component.step_id)

    def finish_success(self, *_args: object) -> None:
        """Record completion after all graph components succeeded."""
        self.finished = True

    def mark_cleanup_eligible(self, run_id: UUID) -> None:
        """Record GC eligibility after terminal completion."""
        self.cleanup_run_ids.append(run_id)

    def finish_failure(self, *_args: object) -> None:
        """Fail if the successful fixture enters terminal failure handling."""
        raise AssertionError("The file pipeline fixture must not fail.")


def test_csv_file_pipeline_runs_through_registered_components_and_retains_only_artifact(
    tmp_path: Path,
) -> None:
    """Claim a manual Source job, transform CSV columns, publish CSV, and clean Datasets."""
    input_root = Path(__file__).parent / "fixtures"
    datasets = LocalDatasetStorage(tmp_path / "storage")
    sources = SourceRegistry()
    transforms = TransformRegistry()
    exports = ExportRegistry()
    artifacts = RecordingArtifactMetadata()
    register_csv_source(sources, CSVSource(datasets, input_root))
    register_column_transforms(transforms, datasets)
    register_csv_artifact_export(
        exports,
        CSVArtifactExport(
            datasets,
            ArtifactPublisher(LocalArtifactStorage(tmp_path / "storage"), artifacts),
        ),
    )
    plan = PipelineExecutionPlan(
        components=(
            PersistedPipelineComponent(
                component_id=SOURCE_ID,
                component_type="source.csv",
                component_version="v1",
                configuration={"sourcePath": "integration-orders.csv"},
                kind="source",
                step_id=SOURCE_STEP_ID,
            ),
            PersistedPipelineComponent(
                component_id=TRANSFORM_ID,
                component_type="transform.columns.select",
                component_version="v1",
                configuration={"columns": ["order_id", "total"]},
                kind="transform",
                step_id=TRANSFORM_STEP_ID,
            ),
            PersistedPipelineComponent(
                component_id=EXPORT_ID,
                component_type="export.csv",
                component_version="v1",
                configuration={"fileName": "orders-clean.csv"},
                kind="export",
                step_id=EXPORT_STEP_ID,
            ),
        ),
        pipeline_id=PIPELINE_ID,
        run_id=RUN_ID,
    )
    repository = RecordingExecutionRepository(plan)
    service = WorkerExecutionService(
        database_url="postgresql://worker:password@localhost:5432/pantaetl",
        datasets=datasets,
        exports=exports,
        repository=repository,
        sources=sources,
        transforms=transforms,
        worker_id=WORKER_ID,
        queue=ClaimedJobQueue(_claimed_job()),
    )

    assert service.run_once() is True
    assert repository.started_steps == [SOURCE_STEP_ID, TRANSFORM_STEP_ID, EXPORT_STEP_ID]
    assert repository.succeeded_steps == [SOURCE_STEP_ID, TRANSFORM_STEP_ID, EXPORT_STEP_ID]
    assert repository.finished is True
    assert repository.cleanup_run_ids == [RUN_ID]
    assert len(repository.datasets) == 2
    assert all(size > 0 for size in repository.dataset_sizes)
    assert all(
        not (tmp_path / "storage" / dataset.storage.location).exists()
        for dataset in repository.datasets
    )
    assert len(artifacts.descriptors) == 1
    artifact = artifacts.descriptors[0]
    assert artifact.retention.retentionDays == 30
    assert artifact.retention.expiresAt > datetime.now(UTC) + timedelta(days=29)
    artifact_path = tmp_path / "storage" / artifact.storage.location
    assert artifact_path.read_text() == "order_id,total\n1,12\n2,25\n"


def _claimed_job() -> Job:
    """Build the scheduler-created Source job after the worker claim transition."""
    now = datetime.now(UTC)
    return Job.model_validate(
        {
            "contractVersion": "v1",
            "id": JOB_ID,
            "pipelineId": PIPELINE_ID,
            "runId": RUN_ID,
            "stepId": SOURCE_STEP_ID,
            "componentId": SOURCE_ID,
            "state": "running",
            "attempt": 1,
            "retryPolicy": {"maxAttempts": 1, "retryDelaySeconds": 0},
            "availableAt": now,
            "claim": {"workerId": WORKER_ID, "claimedAt": now, "heartbeatAt": now},
        }
    )
