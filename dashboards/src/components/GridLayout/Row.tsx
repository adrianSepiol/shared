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
import { PanelGroupItemId, PanelOptions, useLayoutRepeatVariable, useViewPanelGroup } from '@perses-dev/dashboards';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { Layout, Layouts, Responsive, WidthProvider } from 'react-grid-layout';
import { ErrorAlert, ErrorBoundary } from '@perses-dev/components';
import { useVariableValues } from '@perses-dev/plugin-system';
import { GRID_LAYOUT_COLS, GRID_LAYOUT_SMALL_BREAKPOINT } from '../../constants';
import { PanelGroupDefinition, PanelGroupItemLayout } from '../../model';
import { GridContainer } from './GridContainer';
import { GridItemContent } from './GridItemContent';
import { GridTitle } from './GridTitle';
import { RepeatGridItemContent } from './RepeatGridItemContent';

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
  const variableValues = useVariableValues();

  const [isOpen, setIsOpen] = useState(!groupDefinition.isCollapsed);

  const hasViewPanel =
    viewPanelItemId?.panelGroupId === panelGroupId &&
    // Check for repeatVariable panels
    viewPanelItemId.repeatVariable?.group?.[0] === repeatVariable?.[0] &&
    viewPanelItemId.repeatVariable?.group?.[1] === repeatVariable?.[1];
  const itemLayoutViewed = viewPanelItemId?.panelGroupItemLayoutId;

  // If there is a panel in view mode, we should hide the grid if the panel is not in the current group.
  const isGridDisplayed = !viewPanelItemId || hasViewPanel;

  // TODO: handle it without useEffect
  useEffect(() => {
    if (hasViewPanel) {
      setIsOpen(true);
    }
  }, [hasViewPanel]);

  // Item layout is override if there is a panel in view mode
  const itemLayouts: PanelGroupItemLayout[] = useMemo(() => {
    if (itemLayoutViewed) {
      return groupDefinition.itemLayouts.map((itemLayout) => {
        if (itemLayout.i === itemLayoutViewed) {
          const rowTitleHeight = 40 + 8; // 40 is the height of the row title and 8 is the margin height
          return {
            ...itemLayout,
            h: Math.round(((panelFullHeight ?? window.innerHeight) - rowTitleHeight) / (ROW_HEIGHT + DEFAULT_MARGIN)), // Viewed panel should take the full height remaining
            i: itemLayoutViewed,
            w: 48,
            x: 0,
            y: 0,
          } as PanelGroupItemLayout;
        }
        return itemLayout;
      });
    }
    return groupDefinition.itemLayouts;
  }, [groupDefinition.itemLayouts, itemLayoutViewed, panelFullHeight]);

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
          layouts={{ sm: itemLayouts }}
          onLayoutChange={onLayoutChange}
          onWidthChange={onWidthChange}
          allowOverlap={hasViewPanel} // Enabling overlap when viewing a specific panel because panel in front of the viewed panel will add empty spaces (empty row height)
        >
          {itemLayouts.map(({ i, w }) => (
            <div
              key={i}
              style={{
                display: itemLayoutViewed ? (itemLayoutViewed === i ? 'unset' : 'none') : 'unset',
              }}
            >
              <ErrorBoundary FallbackComponent={ErrorAlert}>
                <Component
                  panelGroupId={panelGroupId}
                  panelGroupItemLayoutId={i}
                  groupRepeatVariable={repeatVariable}
                  width={calculateGridItemWidth(w, gridColWidth)}
                  itemGap={DEFAULT_MARGIN}
                  panelOptions={panelOptions}
                  isEditMode={isEditMode}
                  viewPanelItemId={viewPanelItemId}
                />
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

interface RepeatPanelItemProps {
  panelGroupId: PanelGroupId;

  panelGroupItemLayoutId: string;
  groupRepeatVariable?: [string, string];
  width: number;
  itemGap: number;
  panelOptions?: PanelOptions;
  viewPanelItemId?: PanelGroupItemId;
  isEditMode: boolean;
}

const Component = ({
  panelGroupId,
  panelGroupItemLayoutId,
  panelOptions,
  itemGap,
  groupRepeatVariable,
  width,
  isEditMode,
  viewPanelItemId,
}: RepeatPanelItemProps): ReactElement => {
  const panelRepeatVariable = useLayoutRepeatVariable({
    panelGroupId,
    panelGroupItemLayoutId,
  });
  const variables = useVariableValues();
  const variableValues = useMemo((): string[] | undefined => {
    if (!panelRepeatVariable) {
      return undefined;
    }
    const { value: repeatVariableName, mode } = panelRepeatVariable;
    const value = variables[repeatVariableName];
    if (value) {
      if (viewPanelItemId?.repeatVariable?.panel) {
        return [viewPanelItemId.repeatVariable.panel[1]];
      } else if (mode === 'selected' && Array.isArray(value.value) && value.value.length > 0) {
        return value.value;
      } else {
        return value.options?.map((option) => option.value);
      }
    }
  }, [panelRepeatVariable, variables, viewPanelItemId?.repeatVariable?.panel]);

  return panelRepeatVariable && variableValues?.length ? (
    <RepeatGridItemContent
      panelGroupId={panelGroupId}
      panelGroupItemLayoutId={panelGroupItemLayoutId}
      panelRepeatVariable={{
        name: panelRepeatVariable.value,
        values: variableValues,
        maxPer: panelRepeatVariable.alignment === 'vertical' ? 1 : panelRepeatVariable.maxPer,
      }}
      groupRepeatVariable={groupRepeatVariable}
      width={width}
      itemGap={itemGap}
      panelOptions={panelOptions}
      isEditMode={isEditMode}
    />
  ) : (
    <GridItemContent
      panelOptions={panelOptions}
      panelGroupItemId={{
        panelGroupId,
        panelGroupItemLayoutId: panelGroupItemLayoutId,
        repeatVariable: {
          group: groupRepeatVariable,
        },
      }}
      width={width}
    />
  );
};
