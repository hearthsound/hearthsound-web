/**
 * Tests for the add-to-playlist submenu: a whole album is appended in one
 * native request, a single track keeps using the Subsonic surface, and adding
 * to a playlist a service generates asks before it makes the playlist the
 * reader's own.
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

/** A playlist as the submenu reads it, with the lifetime members it looks at. */
interface PlaylistFixture {
  id: string;
  name: string;
  hearthsound?: { temporary: boolean; generatedBy?: string };
}

/** A playlist the reader made, which needs no confirmation. */
const ROAD_TRIP: PlaylistFixture = { id: 'pl_1', name: 'Road Trip' };

/** A playlist a listening service generates, which the first add detaches. */
const GENERATED: PlaylistFixture = {
  id: 'pl_2',
  name: 'Discover Weekly',
  hearthsound: { temporary: true, generatedBy: 'Last.fm' }
};

/**
 * Renders the submenu with its playlists and opens it.
 *
 * @param props The component's props.
 * @param playlists The playlists the read answers with.
 * @returns The rendered container.
 */
async function openWith(
  props: { songId?: string; source?: `album:${string}` },
  playlists: PlaylistFixture[] = [ROAD_TRIP]
) {
  vi.spyOn(libraryApi, 'playlists').mockResolvedValue(playlists as never);
  const rendered = render(AddToPlaylist, { props: { ...props, onnew: () => {} } });
  await fireEvent.click(rendered.getByText('Add to Playlist'));
  await waitFor(() => expect(rendered.getByText(playlists[0].name)).toBeTruthy());
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

  it('asks before adding to a generated playlist, and only the confirm adds', async () => {
    const update = vi.spyOn(libraryApi, 'updatePlaylist').mockResolvedValue(undefined);

    const { getByText, findByText } = await openWith({ songId: 'so_1' }, [GENERATED]);
    await fireEvent.click(getByText('Discover Weekly'));

    expect(await findByText('Edit This Playlist?')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();

    await fireEvent.click(getByText('Edit Playlist'));

    await waitFor(() => expect(update).toHaveBeenCalledWith('pl_2', { add: ['so_1'] }));
  });

  it('adds nothing when the reader keeps the generated playlist as it is', async () => {
    const update = vi.spyOn(libraryApi, 'updatePlaylist').mockResolvedValue(undefined);

    const { getByText, findByText } = await openWith({ songId: 'so_1' }, [GENERATED]);
    await fireEvent.click(getByText('Discover Weekly'));
    await fireEvent.click(await findByText('Cancel'));

    expect(update).not.toHaveBeenCalled();
  });
});
