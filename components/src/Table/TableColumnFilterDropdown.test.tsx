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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import React, { useState } from 'react';

import { TableColumnFilterDropdown } from './TableColumnFilterDropdown';

function DropdownWrapper({
  uniqueValues,
  initialFilterValues = NO_FILTER_VALUES,
}: {
  uniqueValues: Map<unknown, number>;
  initialFilterValues?: unknown[];
}): ReactElement {
  const [filterValues, setFilterValues] = useState<unknown[]>(initialFilterValues);
  return (
    <TableColumnFilterDropdown uniqueValues={uniqueValues} filterValues={filterValues} onFilterChange={setFilterValues} />
  );
}

const STATUS_VALUES = new Map<unknown, number>([
  ['active', 3],
  ['inactive', 2],
]);

const REGION_VALUES = new Map<unknown, number>([
  ['ap-south', 1],
  ['eu-west', 1],
  ['us-east', 2],
  ['us-west', 1],
]);

const NO_FILTER_VALUES: unknown[] = [];
const ACTIVE_FILTER_VALUES: unknown[] = ['active'];
const ALL_STATUS_FILTER_VALUES: unknown[] = ['active', 'inactive'];
const ALL_REGION_FILTER_VALUES: unknown[] = ['ap-south', 'eu-west', 'us-east', 'us-west'];

async function openDropdown(): Promise<void> {
  await act(async () => {
    userEvent.click(screen.getByRole('button', { name: /filter column/i }));
  });
}

/** Type into the search input and flush the 250ms debounce. */
async function typeSearch(value: string): Promise<void> {
  await act(async () => {
    userEvent.type(screen.getByRole('textbox', { hidden: true }), value);
    vi.advanceTimersByTime(300);
  });
}

describe('TableColumnFilterDropdown', () => {
  test('renders a filter icon button', () => {
    render(<DropdownWrapper uniqueValues={STATUS_VALUES} />);
    expect(screen.getByRole('button', { name: /filter column/i })).toBeInTheDocument();
  });

  test('clicking the button opens the popover showing unique values', async () => {
    render(<DropdownWrapper uniqueValues={STATUS_VALUES} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await openDropdown();

    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'active' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'inactive' })).toBeInTheDocument();
  });

  test('values are sorted alphabetically', async () => {
    render(<DropdownWrapper uniqueValues={REGION_VALUES} />);
    await openDropdown();

    const checkboxes = screen.getAllByRole('checkbox');
    // First entry is "Select all", remainder sorted.
    const labels = checkboxes.slice(1).map((cb) => {
      const label = document.querySelector(`label[for="${cb.id}"]`);
      return label?.textContent?.trim() ?? '';
    });
    expect(labels).toEqual(['ap-south', 'eu-west', 'us-east', 'us-west']);
  });

  describe('single-value selection', () => {
    test('clicking a value checks its checkbox', async () => {
      render(<DropdownWrapper uniqueValues={STATUS_VALUES} />);
      await openDropdown();

      const activeCheckbox = screen.getByRole('checkbox', { name: 'active' });
      expect(activeCheckbox).not.toBeChecked();

      await act(async () => {
        userEvent.click(activeCheckbox);
      });

      expect(activeCheckbox).toBeChecked();
    });

    test('clicking a checked value unchecks it', async () => {
      render(<DropdownWrapper uniqueValues={STATUS_VALUES} initialFilterValues={ACTIVE_FILTER_VALUES} />);
      await openDropdown();

      const activeCheckbox = screen.getByRole('checkbox', { name: 'active' });
      expect(activeCheckbox).toBeChecked();

      await act(async () => {
        userEvent.click(activeCheckbox);
      });

      expect(activeCheckbox).not.toBeChecked();
    });

    test('selecting a subset marks "Select all" as indeterminate', async () => {
      render(<DropdownWrapper uniqueValues={STATUS_VALUES} />);
      await openDropdown();

      await act(async () => {
        userEvent.click(screen.getByRole('checkbox', { name: 'active' }));
      });

      const selectAll = screen.getByRole('checkbox', { name: 'Select all' });
      expect(selectAll).not.toBeChecked();
      expect(selectAll).toHaveAttribute('data-indeterminate', 'true');
    });
  });

  describe('"Select all" / "Clear all"', () => {
    test('"Select all" selects every visible value and becomes "Clear all"', async () => {
      render(<DropdownWrapper uniqueValues={STATUS_VALUES} />);
      await openDropdown();

      await act(async () => {
        userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
      });

      expect(screen.getByRole('checkbox', { name: 'active' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'inactive' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Clear all' })).toBeChecked();
    });

    test('"Clear all" deselects all visible values and becomes "Select all"', async () => {
      render(<DropdownWrapper uniqueValues={STATUS_VALUES} initialFilterValues={ALL_STATUS_FILTER_VALUES} />);
      await openDropdown();

      await act(async () => {
        userEvent.click(screen.getByRole('checkbox', { name: 'Clear all' }));
      });

      expect(screen.getByRole('checkbox', { name: 'active' })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'inactive' })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Select all' })).not.toBeChecked();
    });

    test('"Select all" only adds visible (non-filtered) values when search is active', async () => {
      vi.useFakeTimers();
      render(<DropdownWrapper uniqueValues={REGION_VALUES} />);
      await openDropdown();

      await typeSearch('us-');

      expect(screen.queryByRole('checkbox', { name: 'ap-south' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'eu-west' })).not.toBeInTheDocument();

      await act(async () => {
        userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
      });

      expect(screen.getByRole('checkbox', { name: 'us-east' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'us-west' })).toBeChecked();
      vi.useRealTimers();
    });

    test('"Clear all" only removes visible values, leaving non-visible selected values intact', async () => {
      vi.useFakeTimers();
      render(<DropdownWrapper uniqueValues={REGION_VALUES} initialFilterValues={ALL_REGION_FILTER_VALUES} />);
      await openDropdown();

      await typeSearch('us-');

      await act(async () => {
        userEvent.click(screen.getByRole('checkbox', { name: 'Clear all' }));
      });

      expect(screen.getByRole('checkbox', { name: 'us-east' })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'us-west' })).not.toBeChecked();

      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /clear search/i }));
      });

      expect(screen.getByRole('checkbox', { name: 'ap-south' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'eu-west' })).toBeChecked();
      vi.useRealTimers();
    });
  });

  describe('search', () => {
    test('typing in the search box narrows the visible values', async () => {
      vi.useFakeTimers();
      render(<DropdownWrapper uniqueValues={REGION_VALUES} />);
      await openDropdown();

      await typeSearch('us-');

      expect(screen.queryByRole('checkbox', { name: 'ap-south' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'eu-west' })).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'us-east' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'us-west' })).toBeInTheDocument();
      vi.useRealTimers();
    });

    test('search is case-insensitive', async () => {
      vi.useFakeTimers();
      render(<DropdownWrapper uniqueValues={STATUS_VALUES} />);
      await openDropdown();

      await typeSearch('INACTIVE');

      expect(screen.getByRole('checkbox', { name: 'inactive' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'active' })).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    test('clearing the search via the clear button restores all values', async () => {
      vi.useFakeTimers();
      render(<DropdownWrapper uniqueValues={REGION_VALUES} />);
      await openDropdown();

      await typeSearch('us-');

      expect(screen.queryByRole('checkbox', { name: 'ap-south' })).not.toBeInTheDocument();

      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /clear search/i }));
      });

      expect(screen.getByRole('checkbox', { name: 'ap-south' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'eu-west' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'us-east' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'us-west' })).toBeInTheDocument();
      vi.useRealTimers();
    });

    test('the search input shows no clear button when empty', async () => {
      render(<DropdownWrapper uniqueValues={STATUS_VALUES} />);
      await openDropdown();

      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
    });
  });
});
