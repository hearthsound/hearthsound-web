/**
 * Tests for playing an album from the tracklist its page holds: the order, the
 * start position and the answer for an album the server does not have.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { libraryApi } from '#lib/subsonic/library';
import type { AlbumWithSongs } from '#lib/subsonic/types';

import { loadAlbumQueue } from './album-queue';

/** The album the read answers with. */
const album: AlbumWithSongs = {
  id: 'al_1',
  name: 'Blue Hour',
  artist: 'Marlowe Fenn',
  song: [
    { id: 'tr_1', title: 'Northern Line', album: 'Blue Hour' },
    { id: 'tr_2', title: 'Harbour Lights', album: 'Blue Hour' },
    { id: 'tr_3', title: 'Last Ferry', album: 'Blue Hour' }
  ]
};

/**
 * Answers the album read with the given album.
 *
 * @param answer The album to answer with.
 * @returns The call spy.
 */
function answerWith(answer: AlbumWithSongs | null) {
  return vi.spyOn(libraryApi, 'album').mockResolvedValue(answer);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('album queue', () => {
  it('maps the album tracks in playing order', async () => {
    answerWith(album);

    const queue = await loadAlbumQueue('al_1');

    expect(queue?.items.map((item) => item.id)).toEqual(['tr_1', 'tr_2', 'tr_3']);
    expect(queue?.items[0]).toMatchObject({ title: 'Northern Line', album: 'Blue Hour' });
    expect(queue?.startIndex).toBe(0);
  });

  it('starts at the track that was picked', async () => {
    answerWith(album);

    const queue = await loadAlbumQueue('al_1', 'tr_3');

    expect(queue?.startIndex).toBe(2);
  });

  it('starts at the first track when the picked one is not in the album', async () => {
    answerWith(album);

    const queue = await loadAlbumQueue('al_1', 'tr_9');

    expect(queue?.startIndex).toBe(0);
  });

  it('answers nothing for an album the server does not have', async () => {
    answerWith(null);

    await expect(loadAlbumQueue('al_404')).resolves.toBeNull();
  });
});
