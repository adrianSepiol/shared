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

import { Collapse, useTheme } from '@mui/material';
import { PanelGroupId } from '@perses-dev/spec';
import { PanelOptions, useViewPanelGroup } from '@perses-dev/dashboards';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { Layout, Layouts, Responsive, WidthProvider } from 'react-grid-layout';
import { ErrorAlert, ErrorBoundary } from '@perses-dev/components';
import { useVariableValues, VariableContext } from '@perses-dev/plugin-system';
import { GRID_LAYOUT_COLS, GRID_LAYOUT_SMALL_BREAKPOINT } from '../../constants';
import { PanelGroupDefinition, PanelGroupItemLayout } from '../../model';
import { GridContainer } from './GridContainer';
import { GridItemContent } from './GridItemContent';
import { GridTitle } from './GridTitle';

const DEFAULT_MARGIN = 10;
const ROW_HEIGHT = 30;

export interface RowProps {
  panelGroupId: PanelGroupId;
  groupDefinition: PanelGroupDefinition;
  gridColWidth: number;
  panelFullHeight?: number;
  panelOptions?: PanelOptions;
  isEditMode?: boolean;
  onLayoutChange?: (currentLayout: Layout[], allLayouts: Layouts) => void;
  onWidthChange?: (
    containerWidth: number,
    margin: [number, number],
    cols: number,
    containerPadding: [number, number]
  ) => void;
  repeatVariable?: [string, string];
}

export function Row({
  panelGroupId,
  groupDefinition,
  gridColWidth,
  panelFullHeight,
  panelOptions,
  isEditMode = false,
  onLayoutChange,
  onWidthChange,
  repeatVariable,
}: RowProps): ReactElement {
  const ResponsiveGridLayout = useMemo(() => WidthProvider(Responsive), []);
  const theme = useTheme();
  const viewPanelItemId = useViewPanelGroup();
  const variables = useVariableValues();

  const [isOpen, setIsOpen] = useState(!groupDefinition.isCollapsed);

  const hasViewPanel =
    viewPanelItemId?.panelGroupId === panelGroupId &&
    // Check for repeatVariable panels
    viewPanelItemId.repeatVariable?.[0] === repeatVariable?.[0] &&
    viewPanelItemId.repeatVariable?.[1] === repeatVariable?.[1];
  const itemLayoutViewed = viewPanelItemId?.panelGroupItemLayoutId;
  // todo init with sm cols but first check after variable value is persisted
  const [cols, setCols] = useState<number>(0);

  // If there is a panel in view mode, we should hide the grid if the panel is not in the current group.
  const isGridDisplayed = !viewPanelItemId || hasViewPanel;

  // TODO: handle it without useEffect
  useEffect(() => {
    if (hasViewPanel) {
      setIsOpen(true);
    }
  }, [hasViewPanel]);

  // Item layout is override if there is a panel in view mode
  const itemLayouts: Map<string, PanelGroupItemLayout & { variable?: [string, string]; originalI?: string }> =
    useMemo(() => {
      const result: Map<string, PanelGroupItemLayout & { variable?: [string, string]; originalI?: string }> = new Map();
      if (itemLayoutViewed) {
        groupDefinition.itemLayouts.map((itemLayout) => {
          if (itemLayout.i === itemLayoutViewed) {
            const rowTitleHeight = 40 + 8; // 40 is the height of the row title and 8 is the margin height
            result.set(itemLayout.i, {
              h: Math.round(((panelFullHeight ?? window.innerHeight) - rowTitleHeight) / (ROW_HEIGHT + DEFAULT_MARGIN)), // Viewed panel should take the full height remaining
              i: itemLayoutViewed,
              w: 48,
              x: 0,
              y: 0,
              originalI: itemLayoutViewed,
            });
            return result;
          }
          result.set(itemLayout.i, itemLayout);
        });
        // todo cleanup this function
        return result;
      }
      //todo do it once at the store initialization (and listen on variable change) instead of doing it on every render
      groupDefinition.itemLayouts.forEach((itemLayout) => {
        const repeatVariable = itemLayout.repeatVariable;
        const variable = repeatVariable !== undefined ? variables[repeatVariable] : undefined;
        // todo change to available options instead of using selected values
        if (variable && Array.isArray(variable.value) && variable.value.length > 0) {
          let currentX = itemLayout.x;
          let currentY = itemLayout.y;
          variable.value.forEach((value, index) => {
            result.set(`${itemLayout.i}-${value}`, {
              ...itemLayout,
              i: index === 0 ? itemLayout.i : `${itemLayout.i}-${value}`,
              isDraggable: isEditMode && index === 0,
              isResizable: isEditMode && index === 0,
              static: index !== 0,
              allowOverlap: false,
              x: currentX,
              y: currentY,
              originalI: itemLayout.i,
              //todo fix asertion
              variable: [repeatVariable!, value],
            });
            const leftCols = cols - currentX - itemLayout.w;
            currentX = leftCols >= itemLayout.w ? currentX + itemLayout.w : 0;
            currentY = leftCols >= itemLayout.w ? currentY : currentY + itemLayout.h;
          });
        } else {
          result.set(itemLayout.i, itemLayout);
        }
      });
      return result;
    }, [cols, groupDefinition.itemLayouts, isEditMode, itemLayoutViewed, panelFullHeight, variables]);

  return (
    <GridContainer
      sx={{
        display: isGridDisplayed ? 'block' : 'none',
        height: itemLayoutViewed ? `${panelFullHeight}px` : 'unset',
        overflow: itemLayoutViewed ? 'hidden' : 'unset',
      }}
    >
      {groupDefinition.title && (
        <GridTitle
          panelGroupId={panelGroupId}
          title={groupDefinition.title}
          collapse={
            groupDefinition.isCollapsed === undefined
              ? undefined
              : { isOpen: isOpen, onToggleOpen: () => setIsOpen((current) => !current) }
          }
        />
      )}
      <Collapse in={isOpen} unmountOnExit appear={false} data-testid="panel-group-content">
        <ResponsiveGridLayout
          className="layout"
          breakpoints={{ [GRID_LAYOUT_SMALL_BREAKPOINT]: theme.breakpoints.values.sm, xxs: 0 }}
          cols={GRID_LAYOUT_COLS}
          rowHeight={ROW_HEIGHT}
          draggableHandle=".drag-handle"
          resizeHandles={['se']}
          isDraggable={isEditMode && !hasViewPanel}
          isResizable={isEditMode && !hasViewPanel}
          margin={[DEFAULT_MARGIN, DEFAULT_MARGIN]}
          containerPadding={[0, 10]}
          layouts={{
            sm: [...itemLayouts.values()].flat(),
          }}
          onLayoutChange={(currentLayout, allLayouts) => {
            const ids = new Set<string>();
            const uniqueCurrentLayots = currentLayout
              .map((layout) => ({
                ...itemLayouts.get(layout.i),
                ...layout,
                i: itemLayouts.get(layout.i)?.originalI ?? layout.i,
              }))
              .filter(({ i }) => {
                if (ids.has(i)) {
                  return false;
                }
                ids.add(i);
                return true;
              });
            const uniqueAllLayouts = Object.fromEntries(
              Object.entries(allLayouts).map(([breakpoint, layouts]) => {
                const allIds = new Set<string>();
                return [
                  breakpoint,
                  layouts
                    .map((layout) => ({
                      ...itemLayouts.get(layout.i),
                      ...layout,
                      i: itemLayouts.get(layout.i)?.originalI ?? layout.i,
                    }))
                    .filter(({ i }) => {
                      if (allIds.has(i)) {
                        return false;
                      }
                      allIds.add(i);
                      return true;
                    }),
                ];
              })
            );
            onLayoutChange?.(uniqueCurrentLayots, uniqueAllLayouts);
          }}
          onWidthChange={(
            containerWidth: number,
            margin: [number, number],
            cols: number,
            containerPadding: [number, number]
          ) => {
            setCols(cols);
            onWidthChange?.(containerWidth, margin, cols, containerPadding);
          }}
          onDragStart={console.log}
          allowOverlap={hasViewPanel} // Enabling overlap when viewing a specific panel because panel in front of the viewed panel will add empty spaces (empty row height)
        >
          {[...itemLayouts.values()].map(({ i, w, variable, originalI }) => (
            <div
              key={i}
              style={{
                display: itemLayoutViewed ? (itemLayoutViewed === i ? 'unset' : 'none') : 'unset',
              }}
            >
              <ErrorBoundary FallbackComponent={ErrorAlert}>
                {variable ? (
                  <VariableContext.Provider
                    key={`${variable[0]}-${variable[1]}`}
                    value={{ state: { ...variables, [variable[0]]: { value: variable[1], loading: false } } }}
                  >
                    <GridItemContent
                      panelOptions={panelOptions}
                      panelGroupItemId={{
                        panelGroupId,
                        panelGroupItemLayoutId: originalI ?? i,
                      }}
                      width={calculateGridItemWidth(w, gridColWidth)}
                    />
                  </VariableContext.Provider>
                ) : (
                  <GridItemContent
                    panelOptions={panelOptions}
                    panelGroupItemId={{
                      panelGroupId,
                      panelGroupItemLayoutId: originalI ?? i,
                    }}
                    width={calculateGridItemWidth(w, gridColWidth)}
                  />
                )}
              </ErrorBoundary>
            </div>
          ))}
        </ResponsiveGridLayout>
      </Collapse>
    </GridContainer>
  );
}

const calculateGridItemWidth = (w: number, colWidth: number): number => {
  // 0 * Infinity === NaN, which causes problems with resize contraints
  if (!Number.isFinite(w)) return w;
  return Math.round(colWidth * w + Math.max(0, w - 1) * DEFAULT_MARGIN);
};
