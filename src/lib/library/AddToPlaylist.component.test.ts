/**
 * Tests for the add-to-playlist submenu: a whole album is appended in one
 * native request, while a single track keeps using the Subsonic surface.
 */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nativeClient } from '#lib/api/native';
import { libraryApi } from '#lib/subsonic/library';

import AddToPlaylist from './AddToPlaylist.svelte';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Renders the submenu with one playlist and opens it.
 *
 * @param props The component's props.
 * @returns The rendered container.
 */
async function openWith(props: { songId?: string; source?: `album:${string}` }) {
  vi.spyOn(libraryApi, 'playlists').mockResolvedValue([{ id: 'pl_1', name: 'Road Trip' }] as never);
  const rendered = render(AddToPlaylist, { props: { ...props, onnew: () => {} } });
  await fireEvent.click(rendered.getByText('Add to Playlist'));
  await waitFor(() => expect(rendered.getByText('Road Trip')).toBeTruthy());
  return rendered;
}

describe('add to playlist', () => {
  it('appends a whole album in one native request', async () => {
    const post = vi
      .spyOn(nativeClient, 'POST')
      .mockResolvedValue({ data: { added: 10, trackCount: 10 } } as never);
    const update = vi.spyOn(libraryApi, 'updatePlaylist');

    const { getByText } = await openWith({ source: 'album:al_1' });
    await fireEvent.click(getByText('Road Trip'));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/api/v1/playlists/{id}/tracks', {
      params: { path: { id: 'pl_1' } },
      body: { source: 'album:al_1' }
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('adds a single track through the Subsonic surface', async () => {
    const update = vi.spyOn(libraryApi, 'updatePlaylist').mockResolvedValue(undefined);
    const post = vi.spyOn(nativeClient, 'POST');

    const { getByText } = await openWith({ songId: 'so_1' });
    await fireEvent.click(getByText('Road Trip'));

    await waitFor(() => expect(update).toHaveBeenCalledWith('pl_1', { add: ['so_1'] }));
    expect(post).not.toHaveBeenCalled();
  });
});
