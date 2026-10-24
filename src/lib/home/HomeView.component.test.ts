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

import HomeView from './HomeView.svelte';

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
  localStorage.clear();
});

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
});
