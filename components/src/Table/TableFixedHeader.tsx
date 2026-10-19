// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { ColumnFiltersState, Header, HeaderContext, HeaderGroup } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import type { ReactElement, SetStateAction } from 'react';import { useCallback, useMemo } from 'react';

import type { TableDensity } from './model/table-model';
import type { TableCellProps } from './TableCell';
import { TableHeaderCell } from './TableHeaderCell';
import { TableRow } from './TableRow';

type TableCellPosition = {
  row: number;
  column: number;
};

interface TableFixedHeaderProps<TableData> {
  headers: Array<HeaderGroup<TableData>>;
  density: TableDensity;
  defaultColumnWidth: number | 'auto';
  defaultColumnHeight: number | 'auto';
  columnFilterConfig?: {
    columnFilters: ColumnFiltersState;
    onColumnFiltersChange: (filters: SetStateAction<ColumnFiltersState>) => void;
  };
  getFocusState: (position: TableCellPosition) => TableCellProps['focusState'];
  onCellFocus: (position: TableCellPosition) => void;
}

export function TableFixedHeader<TableData>({
  headers,
  density,
  defaultColumnWidth,
  defaultColumnHeight,
  columnFilterConfig,
  getFocusState,
  onCellFocus,
}: TableFixedHeaderProps<TableData>): ReactElement {
  return (
    <>
      {headers.map((headerGroup) => (
        <TableRow key={headerGroup.id} density={density}>
          {headerGroup.headers.map((header, i, allHeaders) => (
            <TableHeaderCellItem
              key={header.id}
              column={header.column}
              headerId={header.id}
              getResizeHandler={header.getResizeHandler}
              getContext={header.getContext}
              index={i}
              totalHeaders={allHeaders.length}
              density={density}
              defaultColumnWidth={defaultColumnWidth}
              defaultColumnHeight={defaultColumnHeight}
              columnFilterConfig={columnFilterConfig}
              getFocusState={getFocusState}
              onCellFocus={onCellFocus}
            />
          ))}
        </TableRow>
      ))}
    </>
  );
}

interface TableHeaderCellItemProps<TableData> {
  column: Header<TableData, unknown>['column'];
  headerId: string;
  getResizeHandler: () => (event: unknown) => void;
  getContext: () => HeaderContext<TableData, unknown>;
  index: number;
  totalHeaders: number;
  density: TableDensity;
  defaultColumnWidth: number | 'auto';
  defaultColumnHeight: number | 'auto';
  columnFilterConfig?: {
    columnFilters: ColumnFiltersState;
    onColumnFiltersChange: (filters: SetStateAction<ColumnFiltersState>) => void;
  };
  getFocusState: (position: TableCellPosition) => TableCellProps['focusState'];
  onCellFocus: (position: TableCellPosition) => void;
}

function TableHeaderCellItem<TableData>({
  column,
  headerId,
  getResizeHandler,
  getContext,
  index,
  totalHeaders,
  density,
  defaultColumnWidth,
  defaultColumnHeight,
  columnFilterConfig,
  getFocusState,
  onCellFocus,
}: TableHeaderCellItemProps<TableData>): ReactElement {
  const position: TableCellPosition = { row: 0, column: index };

  const isSorted = column.getIsSorted();
  const nextSorting = column.getNextSortingOrder();

  const handleFilterChange = useCallback(
    (values: unknown[]) => {
      columnFilterConfig?.onColumnFiltersChange((prev) => {
        if (values.length === 0) {
          return prev.filter((f) => f.id !== column.id);
        }
        const existing = prev.find((f) => f.id === column.id);
        if (existing) {
          return prev.map((f) => (f.id === column.id ? { ...f, value: values } : f));
        }
        return [...prev, { id: column.id, value: values }];
      });
    },
    [column.id, columnFilterConfig],
  );

  const handleFocusTrigger = useCallback(() => onCellFocus({ row: 0, column: index }), [onCellFocus, index]);

  const isResizing = column.getIsResizing();
  const canResize = column.getCanResize();
  const resizeConfig = useMemo(
    () =>
      canResize
        ? {
            resizeHandler: getResizeHandler(),
            resetSizeHandler: column.resetSize,
            isResizing,
          }
        : undefined,
    [canResize, getResizeHandler, column.resetSize, isResizing],
  );

  const filterConfig = useMemo(() => {
    if (columnFilterConfig && column.columnDef.enableColumnFilter) {
      const uniqueValues = column.getFacetedUniqueValues();
      const columnId = column.id;
      const filterValues = (columnFilterConfig.columnFilters.find((f) => f.id === columnId)?.value as unknown[]) ?? [];
      return {
        uniqueValues,
        filterValues,
        onFilterChange: handleFilterChange,
      };
    }
  }, [columnFilterConfig, handleFilterChange, column]);

  return (
    <TableHeaderCell
      onSort={column.getCanSort() ? column.getToggleSortingHandler() : undefined}
      sortDirection={typeof isSorted === 'string' ? isSorted : undefined}
      nextSortDirection={typeof nextSorting === 'string' ? nextSorting : undefined}
      width={
        column.getCanResize() ? `calc(var(--header-${headerId}-size) * 1px)` : column.getSize() || defaultColumnWidth
      }
      defaultColumnHeight={defaultColumnHeight}
      align={column.columnDef.meta?.align}
      variant="head"
      density={density}
      description={column.columnDef.meta?.headerDescription}
      focusState={getFocusState(position)}
      onFocusTrigger={handleFocusTrigger}
      isFirstColumn={index === 0}
      isLastColumn={index === totalHeaders - 1}
      resizeConfig={resizeConfig}
      filterConfig={filterConfig}
    >
      {flexRender(column.columnDef.header, getContext())}
    </TableHeaderCell>
  );
}
