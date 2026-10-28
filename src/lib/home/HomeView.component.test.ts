/**
 * Tests for Home's shelving: each shelf is drawn as soon as its own answer
 * arrives, a slow section only keeps its own placeholder, and a section the
 * server could not answer does not take the page down with it.
 */
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The shelf reader the page gets, which each test answers by section id.
 */
const reader = vi.hoisted(() => ({ read: vi.fn<(id: string) => Promise<unknown>>() }));

vi.mock('#lib/home/data', () => ({
  HOME_SHELF_SIZE: 20,
  HOME_SONG_ROWS: 5,
  createHomeShelfReader: () => reader.read
}));

import { events } from '#lib/stores/events.svelte';

import HomeView from './HomeView.svelte';
import { HOME_SECTION_BY_ID } from './sections';

// jsdom has no ResizeObserver, which a shelf uses to measure its row.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
);

/** A section with nothing in it. */
const EMPTY = { albums: [], artists: [], songs: [], playlists: [] };

/** Recently Added with one album. */
const WITH_ALBUM = {
  ...EMPTY,
  albums: [{ id: 'al_1', name: 'Recent Album', artist: 'Test Artist', songCount: 1 }]
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

/**
 * Captures the handlers a rendered page registers on the event stream.
 *
 * The store owns one connection for the page, so a test drives the page by
 * calling the handler the page itself registered, exactly as a frame would.
 *
 * @returns The handlers, keyed by event type.
 */
function captureHandlers(): Record<string, ((event: unknown) => void)[]> {
  const handlers: Record<string, ((event: unknown) => void)[]> = {};
  vi.spyOn(events, 'on').mockImplementation((type, handler) => {
    (handlers[type] ??= []).push(handler as (event: unknown) => void);
    return () => {};
  });
  return handlers;
}

/** Calls every handler a page registered for one event type. */
function emit(
  handlers: Record<string, ((event: unknown) => void)[]>,
  type: string,
  event: unknown
): void {
  for (const handler of handlers[type] ?? []) {
    handler(event);
  }
}

describe('Home shelves', () => {
  it('draws a shelf while a slower section is still on its way', async () => {
    const slow = Promise.withResolvers<unknown>();
    reader.read.mockImplementation((id: string) => {
      if (id === 'recently-added') {
        return Promise.resolve(WITH_ALBUM);
      }
      if (id === 'recommended-albums') {
        return slow.promise;
      }
      return Promise.resolve(EMPTY);
    });

    const rendered = render(HomeView);

    await waitFor(() =>
      expect(rendered.queryByRole('region', { name: 'Recently Added' })).not.toBeNull()
    );
    expect(rendered.queryByText('Nothing to Show Yet')).toBeNull();
    expect(rendered.queryByRole('region', { name: 'Recommended Albums' })).toBeNull();
    // The shelf still on its way keeps a placeholder, so the row does not jump.
    expect(rendered.container.querySelectorAll('.hs-skeleton').length).toBeGreaterThan(0);

    slow.resolve(EMPTY);
    await waitFor(() => expect(rendered.container.querySelectorAll('.hs-skeleton').length).toBe(0));
  });

  it('leaves out a section the server could not read and keeps the rest', async () => {
    reader.read.mockImplementation((id: string) => {
      if (id === 'recently-added') {
        return Promise.resolve(WITH_ALBUM);
      }
      if (id === 'recommended-albums') {
        return Promise.reject(new Error('the listening service did not answer'));
      }
      return Promise.resolve(EMPTY);
    });

    const rendered = render(HomeView);

    await waitFor(() =>
      expect(rendered.queryByRole('region', { name: 'Recently Added' })).not.toBeNull()
    );
    expect(rendered.queryByText('Could Not Load This Page')).toBeNull();
    expect(rendered.queryByRole('region', { name: 'Recommended Albums' })).toBeNull();
  });

  it('shows the page-wide error only when no section answered', async () => {
    reader.read.mockRejectedValue(new Error('the server did not answer'));

    const rendered = render(HomeView);

    await waitFor(() => expect(rendered.queryByText('Could Not Load This Page')).not.toBeNull());
    expect(rendered.queryByText('Nothing to Show Yet')).toBeNull();
  });

  it('shows the empty state once every section answered nothing', async () => {
    reader.read.mockResolvedValue(EMPTY);

    const rendered = render(HomeView);

    await waitFor(() => expect(rendered.queryByText('Nothing to Show Yet')).not.toBeNull());
    expect(rendered.queryByText('Could Not Load This Page')).toBeNull();
  });

  it('re-reads only the Discovery shelves when the indexer stores an album', async () => {
    const handlers = captureHandlers();
    reader.read.mockResolvedValue(EMPTY);
    render(HomeView);
    await waitFor(() => expect(reader.read).toHaveBeenCalled());

    vi.useFakeTimers();
    reader.read.mockClear();
    emit(handlers, 'entity.updated', {
      type: 'entity.updated',
      data: { id: 'al_1', kind: 'album' }
    });
    await vi.advanceTimersByTimeAsync(5000);

    const readIds = reader.read.mock.calls.map((call) => call[0] as string);
    expect(readIds.length).toBeGreaterThan(0);
    for (const id of readIds) {
      expect(HOME_SECTION_BY_ID[id]?.discovery).toBe(true);
    }
    expect(readIds).not.toContain('random-albums');
    expect(readIds).not.toContain('random-songs');
  });

  it('re-reads the whole page when the library itself changes', async () => {
    const handlers = captureHandlers();
    reader.read.mockResolvedValue(EMPTY);
    render(HomeView);
    await waitFor(() => expect(reader.read).toHaveBeenCalled());

    vi.useFakeTimers();
    reader.read.mockClear();
    emit(handlers, 'library.changed', { type: 'library.changed', data: {} });
    await vi.advanceTimersByTimeAsync(1500);

    const readIds = new Set(reader.read.mock.calls.map((call) => call[0] as string));
    expect(readIds).toContain('recently-added');
    expect(readIds).toContain('recommended-albums');
    expect([...readIds].some((id) => HOME_SECTION_BY_ID[id]?.discovery === false)).toBe(true);
  });
});
