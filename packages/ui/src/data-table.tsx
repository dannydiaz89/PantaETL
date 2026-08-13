"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type Row,
  type RowData,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Icon } from "./icon.js";

/** Localized labels used to describe a column's current or next sorting behavior. */
export interface DataTableSortLabels {
  readonly ascending: (column: string) => string;
  readonly descending: (column: string) => string;
  readonly none: (column: string) => string;
}

/** Column definition accepted by the design-system data table. */
export type DataTableColumn<TData extends RowData> = ColumnDef<TData, unknown>;

/** Accessible, theme-aware table settings supplied by each localized screen. */
export interface DataTableProps<TData extends RowData> {
  readonly caption: string;
  readonly columns: readonly DataTableColumn<TData>[];
  readonly data: readonly TData[];
  readonly emptyState: ReactNode;
  readonly getColumnLabel: (columnId: string) => string;
  readonly getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string;
  readonly isLoading?: boolean;
  readonly loadingState: ReactNode;
  readonly sortLabels: DataTableSortLabels;
}

/**
 * Renders a responsive semantic table with client-side sorting and explicit states.
 *
 * The caller supplies all visible state text, keeping localization outside the
 * design-system boundary while the component owns keyboard and sort semantics.
 */
export function DataTable<TData extends RowData>({
  caption,
  columns,
  data,
  emptyState,
  getColumnLabel,
  getRowId,
  isLoading = false,
  loadingState,
  sortLabels,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    columns: [...columns],
    data: [...data],
    getCoreRowModel: getCoreRowModel(),
    ...(getRowId === undefined ? {} : { getRowId }),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  if (isLoading) {
    return <div aria-busy="true" aria-live="polite" className="ui-data-table__state" role="status">{loadingState}</div>;
  }

  if (data.length === 0) {
    return <div className="ui-data-table__state" role="status">{emptyState}</div>;
  }

  return (
    <div className="ui-data-table__scroll" tabIndex={0}>
      <table className="ui-data-table">
        <caption className="ui-sr-only">{caption}</caption>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const column = header.column;
                const sortingState = column.getIsSorted();
                const columnLabel = getColumnLabel(column.id);
                const canSort = column.getCanSort();
                return (
                  <th
                    aria-sort={sortingState === false ? "none" : sortingState === "asc" ? "ascending" : "descending"}
                    key={header.id}
                    scope="col"
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        aria-label={sortLabel(sortLabels, columnLabel, sortingState)}
                        className="ui-data-table__sort-button"
                        onClick={column.getToggleSortingHandler()}
                        type="button"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon state={sortingState} />
                      </button>
                    ) : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Chooses a restrained sort icon while leaving the text alternative to the button label. */
function SortIcon({ state }: { readonly state: false | "asc" | "desc" }) {
  const icon = state === "asc" ? ArrowUp : state === "desc" ? ArrowDown : ArrowUpDown;
  return <Icon icon={icon} size={14} />;
}

/** Resolves the localized sorting action for one current column state. */
function sortLabel(labels: DataTableSortLabels, column: string, state: false | "asc" | "desc"): string {
  return state === "asc" ? labels.descending(column) : state === "desc" ? labels.none(column) : labels.ascending(column);
}
