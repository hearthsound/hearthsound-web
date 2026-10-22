/**
 * Tests for the paged list: what it accumulates, when it stops and what a
 * failed read leaves behind.
 */
import { describe, expect, it, vi } from 'vitest';

import { PagedList } from './paging.svelte';
import type { Page } from './paging.svelte';

/**
 * Builds a loader that answers with the given pages, in order.
 *
 * @param pages The pages to answer with.
 * @returns The loader and the cursors it was asked for.
 */
function scripted(pages: Page<string, number>[]) {
  const cursors: (number | null)[] = [];
  const load = async (cursor: number | null): Promise<Page<string, number>> => {
    cursors.push(cursor);
    const page = pages[cursors.length - 1];
    if (page === undefined) {
      throw new Error('the loader was called more often than the script holds pages');
    }
    return page;
  };
  return { load, cursors };
}

describe('paged list', () => {
  it('accumulates the pages until one reports no next cursor', async () => {
    const list = new PagedList<string>((item) => item);
    const { load, cursors } = scripted([
      { items: ['a', 'b'], next: 2 },
      { items: ['c'], next: 3 },
      { items: ['d'], next: null }
    ]);

    list.start(load);
    await vi.waitFor(() => expect(list.loading).toBe(false));
    expect(list.done).toBe(false);

    await list.loadMore();
    await list.loadMore();

    expect(list.items).toEqual(['a', 'b', 'c', 'd']);
    expect(cursors).toEqual([null, 2, 3]);
    expect(list.done).toBe(true);
  });

  it('reads nothing further once the last page arrived', async () => {
    const list = new PagedList<string>((item) => item);
    const { load, cursors } = scripted([{ items: ['a'], next: null }]);

    list.start(load);
    await vi.waitFor(() => expect(list.loading).toBe(false));
    await list.loadMore();

    expect(cursors).toEqual([null]);
  });

  it('ignores a read while one is already running', async () => {
    const list = new PagedList<string>((item) => item);
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const load = async (): Promise<Page<string, number>> => {
      await gate;
      return { items: ['a'], next: null };
    };

    list.start(load);
    await list.loadMore();
    expect(list.items).toEqual([]);

    release();
    await vi.waitFor(() => expect(list.loading).toBe(false));
    expect(list.items).toEqual(['a']);
    // A list whose last page arrived takes no further read either.
    await list.loadMore();
    expect(list.items).toEqual(['a']);
  });

  it('keeps the rows it read and stays open when a read fails', async () => {
    const list = new PagedList<string>((item) => item);
    let attempt = 0;
    const load = async (): Promise<Page<string, number>> => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('the server did not answer');
      }
      return { items: ['a'], next: null };
    };

    list.start(load);
    await vi.waitFor(() => expect(list.loading).toBe(false));
    expect(list.failure).toBe('the server did not answer');
    expect(list.done).toBe(false);

    await list.loadMore();
    expect(list.failure).toBeNull();
    expect(list.items).toEqual(['a']);
  });

  it('drops the previous rows and the previous read when it starts over', async () => {
    const list = new PagedList<string>((item) => item);
    const { load } = scripted([{ items: ['a', 'b'], next: 2 }]);
    list.start(load);
    await vi.waitFor(() => expect(list.loading).toBe(false));

    const second = scripted([{ items: ['x'], next: null }]);
    list.start(second.load);

    expect(list.items).toEqual([]);
    await vi.waitFor(() => expect(list.loading).toBe(false));
    expect(list.items).toEqual(['x']);
  });

  it('skips a row that arrived on an earlier page', async () => {
    const list = new PagedList<string>((item) => item);
    const { load } = scripted([
      { items: ['a', 'b'], next: 2 },
      { items: ['b', 'c'], next: null }
    ]);

    list.start(load);
    await vi.waitFor(() => expect(list.loading).toBe(false));
    await list.loadMore();

    expect(list.items).toEqual(['a', 'b', 'c']);
    expect(list.done).toBe(true);
  });

  it('keeps reading while pages only repeat rows', async () => {
    const list = new PagedList<string>((item) => item);
    const { load, cursors } = scripted([
      { items: ['a'], next: 2 },
      { items: ['a'], next: 3 },
      { items: ['a', 'b'], next: null }
    ]);

    list.start(load);
    await vi.waitFor(() => expect(list.loading).toBe(false));
    // The second page repeats the first one, so this call keeps reading.
    await list.loadMore();

    expect(list.items).toEqual(['a', 'b']);
    expect(list.done).toBe(true);
    expect(cursors.length).toBe(3);
  });
});
