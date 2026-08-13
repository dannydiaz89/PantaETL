"""Tests for safe XLSX acquisition and Dataset persistence."""

from pathlib import Path
from uuid import UUID
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

import pytest

from workers.python.components.sources.xlsx_source import XLSXSource, XLSXSourceError
from workers.python.generated.source_execution_request import SourceExecutionRequest
from workers.python.storage import LocalDatasetStorage

PIPELINE_ID = UUID("00000000-0000-0000-0000-000000000001")
RUN_ID = UUID("00000000-0000-0000-0000-000000000002")
STEP_ID = UUID("00000000-0000-0000-0000-000000000003")


def source_request(values: dict[str, object]) -> SourceExecutionRequest:
    """Build a valid XLSX Source request with portable configuration values."""
    return SourceExecutionRequest.model_validate(
        {
            "contractVersion": "v1",
            "jobId": "00000000-0000-0000-0000-000000000004",
            "pipelineId": str(PIPELINE_ID),
            "runId": str(RUN_ID),
            "stepId": str(STEP_ID),
            "componentId": "00000000-0000-0000-0000-000000000005",
            "componentType": "source.xlsx",
            "componentVersion": "v1",
            "configuration": {"values": values, "secretBindings": []},
        }
    )


def write_workbook(path: Path, sheets: dict[str, list[list[object]]]) -> None:
    """Write a small XLSX fixture without adding a workbook-writing runtime dependency."""
    shared_values = [
        str(value)
        for rows in sheets.values()
        for row in rows
        for value in row
        if isinstance(value, str)
    ]
    unique_strings = list(dict.fromkeys(shared_values))
    shared_indexes = {value: index for index, value in enumerate(unique_strings)}
    sheet_names = list(sheets)

    with ZipFile(path, "w", ZIP_DEFLATED) as workbook:
        workbook.writestr(
            "[Content_Types].xml",
            """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
  <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>
  <Default Extension=\"xml\" ContentType=\"application/xml\"/>
  <Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>
  <Override PartName=\"/xl/sharedStrings.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml\"/>
"""
            + "\n".join(
                f'  <Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                for index in range(1, len(sheet_names) + 1)
            )
            + "\n</Types>",
        )
        workbook.writestr(
            "_rels/.rels",
            """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>
</Relationships>""",
        )
        workbook.writestr(
            "xl/workbook.xml",
            """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">
  <sheets>"""
            + "".join(
                f'<sheet name="{escape(name)}" sheetId="{index}" r:id="rId{index}"/>'
                for index, name in enumerate(sheet_names, start=1)
            )
            + "</sheets>\n</workbook>",
        )
        workbook.writestr(
            "xl/_rels/workbook.xml.rels",
            """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"""
            + "".join(
                f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
                for index in range(1, len(sheet_names) + 1)
            )
            + '<Relationship Id="rIdSharedStrings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
            + "</Relationships>",
        )
        workbook.writestr(
            "xl/sharedStrings.xml",
            """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" count=\""""
            + str(len(shared_values))
            + '" uniqueCount="'
            + str(len(unique_strings))
            + '">'
            + "".join(f"<si><t>{escape(value)}</t></si>" for value in unique_strings)
            + "</sst>",
        )
        for sheet_index, rows in enumerate(sheets.values(), start=1):
            workbook.writestr(
                f"xl/worksheets/sheet{sheet_index}.xml",
                """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>"""
                + "".join(
                    f'<row r="{row_index}">'
                    + "".join(
                        _cell_xml(column_index, row_index, value, shared_indexes)
                        for column_index, value in enumerate(row, start=1)
                    )
                    + "</row>"
                    for row_index, row in enumerate(rows, start=1)
                )
                + "</sheetData></worksheet>",
            )


def _cell_xml(
    column_index: int, row_index: int, value: object, shared_indexes: dict[str, int]
) -> str:
    """Encode one fixture cell using a shared string or numeric XLSX representation."""
    column_name = chr(ord("A") + column_index - 1)
    if isinstance(value, str):
        return f'<c r="{column_name}{row_index}" t="s"><v>{shared_indexes[value]}</v></c>'
    return f'<c r="{column_name}{row_index}"><v>{value}</v></c>'


def test_xlsx_source_reads_requested_sheet_and_persists_tabular_data(tmp_path: Path) -> None:
    """An XLSX Source produces the canonical temporary tabular Dataset format."""
    inputs = tmp_path / "inputs"
    inputs.mkdir()
    write_workbook(
        inputs / "orders.xlsx",
        {
            "Orders": [["order_id", "total"], [1, 12.5], [2, 9]],
            "Ignored": [["value"], [999]],
        },
    )
    storage = LocalDatasetStorage(tmp_path / "datasets")

    descriptor = XLSXSource(storage, inputs)(
        source_request({"sourcePath": "orders.xlsx", "sheetName": "Orders"})
    )

    assert descriptor.family.value == "tabular"
    assert descriptor.pipelineId == PIPELINE_ID
    assert descriptor.runId == RUN_ID
    assert storage.read_tabular(descriptor).to_dicts() == [
        {"order_id": 1, "total": 12.5},
        {"order_id": 2, "total": 9.0},
    ]


def test_xlsx_source_defaults_to_first_sheet_and_supports_headerless_data(tmp_path: Path) -> None:
    """The first worksheet is selected by default and header parsing is configurable."""
    write_workbook(tmp_path / "orders.xlsx", {"Orders": [[1, 12.5], [2, 9]]})
    storage = LocalDatasetStorage(tmp_path / "datasets")

    descriptor = XLSXSource(storage, tmp_path)(
        source_request({"sourcePath": "orders.xlsx", "hasHeader": False})
    )

    assert storage.read_tabular(descriptor).to_dicts() == [
        {"column_1": 1, "column_2": 12.5},
        {"column_1": 2, "column_2": 9.0},
    ]


def test_xlsx_source_rejects_unsafe_paths_and_safe_errors_omit_cell_contents(
    tmp_path: Path,
) -> None:
    """Invalid source input fails without echoing workbook cell contents into an error."""
    source = XLSXSource(LocalDatasetStorage(tmp_path / "datasets"), tmp_path)

    with pytest.raises(XLSXSourceError, match="safe relative") as error:
        source(source_request({"sourcePath": "../sensitive.xlsx"}))

    assert "cell" not in str(error.value).lower()
