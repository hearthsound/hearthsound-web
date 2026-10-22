/**
 * Tests for the reorderable list's keyboard: picking a row up, moving it,
 * reporting the new order, announcing the position, and Escape cancelling.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ReorderList from './ReorderList.svelte';

/** One row of the list under test. */
interface Row {
  /** The item's identity. */
  id: string;
}

/** The rows the tests reorder. */
const rows: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

/** The row content: the item's identity, which is all the tests read. */
const children = createRawSnippet<[Row, number]>((item) => ({
  render: () => `<span>${item().id}</span>`
}));

/** The ids of an order, for readable assertions. */
function ids(items: Row[]): string[] {
  return items.map((item) => item.id);
}

afterEach(() => {
  cleanup();
});

describe('reorder list keyboard', () => {
  it('moves a picked row down and announces its position', async () => {
    const onchange = vi.fn();
    render(ReorderList, { items: rows, label: 'Layers', handles: 'always', onchange, children });
    const [first] = screen.getAllByRole('listitem');

    first.focus();
    await fireEvent.keyDown(first, { key: ' ' });
    expect(screen.getByRole('status').textContent).toBe('Moving, position 1 of 3');

    await fireEvent.keyDown(first, { key: 'ArrowDown' });

    expect(ids(onchange.mock.calls[0][0])).toEqual(['b', 'a', 'c']);
    expect(screen.getByRole('status').textContent).toBe('Moving, position 2 of 3');
  });

  it('returns a grabbed row to where it was picked up on Escape', async () => {
    const onchange = vi.fn();
    render(ReorderList, { items: rows, label: 'Layers', handles: 'always', onchange, children });
    const [first] = screen.getAllByRole('listitem');

    first.focus();
    await fireEvent.keyDown(first, { key: ' ' });
    await fireEvent.keyDown(first, { key: 'ArrowDown' });
    await fireEvent.keyDown(first, { key: 'Escape' });

    expect(ids(onchange.mock.calls[onchange.mock.calls.length - 1][0])).toEqual(['a', 'b', 'c']);
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
