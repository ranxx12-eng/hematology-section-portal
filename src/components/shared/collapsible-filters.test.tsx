import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollapsibleFilters, countActiveFilterValues } from '@/components/shared/collapsible-filters';

describe('CollapsibleFilters', () => {
  const defaults = { status: 'all', search: '' };

  it('counts active filters excluding defaults', () => {
    expect(countActiveFilterValues(defaults, defaults)).toBe(0);
    expect(countActiveFilterValues({ status: 'OUT', search: '' }, defaults)).toBe(1);
    expect(countActiveFilterValues({ status: 'all', search: 'abc' }, defaults)).toBe(1);
  });

  it('is collapsed by default and opens from the Filters button', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleFilters activeCount={1} onClearAll={() => undefined}>
        <label htmlFor="filter-search">Search</label>
        <input id="filter-search" defaultValue="test" />
      </CollapsibleFilters>,
    );

    expect(screen.queryByLabelText('Search')).toBeNull();
    await user.click(screen.getAllByRole('button', { name: /Filters, 1 active/i })[0]!);
    expect(screen.getByLabelText('Search')).toBeTruthy();
  });
});
