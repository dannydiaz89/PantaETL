"""Generate Pydantic contract models from the canonical JSON Schema documents."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIRECTORY = ROOT / "schemas" / "contracts"
OUTPUT_DIRECTORY = ROOT / "workers" / "python" / "generated"
SCHEMAS = (
    ("artifact-descriptor.schema.json", "artifact_descriptor.py", "ArtifactDescriptor"),
    ("component-metadata.schema.json", "component_metadata.py", "ComponentMetadata"),
    ("dataset-descriptor.schema.json", "dataset_descriptor.py", "DatasetDescriptor"),
    ("job.schema.json", "job.py", "Job"),
    ("pipeline.schema.json", "pipeline.py", "Pipeline"),
    ("run.schema.json", "run.py", "Run"),
    (
        "source-execution-request.schema.json",
        "source_execution_request.py",
        "SourceExecutionRequest",
    ),
)


def generate_model(
    output_directory: Path,
    schema_filename: str,
    output_filename: str,
    class_name: str,
) -> None:
    """Generate one deterministic Pydantic v2 module from one schema document."""
    subprocess.run(
        [
            sys.executable,
            "-m",
            "datamodel_code_generator",
            "--input",
            str(SCHEMA_DIRECTORY / schema_filename),
            "--input-file-type",
            "jsonschema",
            "--output",
            str(output_directory / output_filename),
            "--output-model-type",
            "pydantic_v2.BaseModel",
            "--class-name",
            class_name,
            "--disable-timestamp",
            "--formatters",
            "ruff-format",
            "--use-annotated",
            "--field-constraints",
            "--use-standard-collections",
            "--use-union-operator",
            "--target-python-version",
            "3.13",
        ],
        check=True,
        cwd=ROOT,
    )


def generate_all(output_directory: Path) -> None:
    """Generate all worker-facing Pydantic contract models."""
    output_directory.mkdir(parents=True, exist_ok=True)

    for schema_filename, output_filename, class_name in SCHEMAS:
        generate_model(output_directory, schema_filename, output_filename, class_name)

    subprocess.run(
        ["ruff", "check", "--fix", "--ignore", "UP045", str(output_directory)],
        check=True,
        cwd=ROOT,
    )
    subprocess.run(["ruff", "format", str(output_directory)], check=True, cwd=ROOT)


def check_generated_models() -> None:
    """Compare freshly generated models in temporary storage with committed models."""
    with TemporaryDirectory(prefix="pantaetl-contract-models-") as temporary_directory:
        generated_directory = Path(temporary_directory)
        generate_all(generated_directory)

        stale_files = [
            output_filename
            for _, output_filename, _ in SCHEMAS
            if not (OUTPUT_DIRECTORY / output_filename).is_file()
            or (OUTPUT_DIRECTORY / output_filename).read_bytes()
            != (generated_directory / output_filename).read_bytes()
        ]

    if stale_files:
        filenames = ", ".join(stale_files)
        raise SystemExit(
            f"Generated Pydantic contract models are stale: {filenames}. Run pnpm generate."
        )


def main() -> None:
    """Generate or verify all worker-facing Pydantic contract models."""
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify generated models without writing to the repository",
    )
    arguments = parser.parse_args()

    if arguments.check:
        check_generated_models()
    else:
        generate_all(OUTPUT_DIRECTORY)


if __name__ == "__main__":
    main()
