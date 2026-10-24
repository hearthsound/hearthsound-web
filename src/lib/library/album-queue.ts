/**
 * Plays an album from the tracklist its page holds.
 *
 * An album page is the same listing whichever id opened it, and its tracks are
 * already read: the whole catalog tracklist with the stored tracks in their
 * places. Queueing the album therefore reads nothing more, and an album the
 * caller's library does not hold plays exactly like one it does.
 *
 * @module
 */
import type { CollectionQueue } from '#lib/library/queue-source';
import { queueItemOf } from '#lib/player/tracks';
import { libraryApi } from '#lib/subsonic/library';

/**
 * Reads an album as a queue.
 *
 * @param id The album's client id, stored or catalog.
 * @param from The track to start at; absent starts at the first.
 * @returns The album's tracks in playing order and the start position, or
 *   `null` when the server has no such album the caller may see.
 */
export async function loadAlbumQueue(id: string, from?: string): Promise<CollectionQueue | null> {
  const album = await libraryApi.album(id);
  if (album === null) {
    return null;
  }
  const items = (album.song ?? []).map(queueItemOf);
  const index = from === undefined ? -1 : items.findIndex((item) => item.id === from);
  return {
    items,
    startIndex: index < 0 ? 0 : index
  };
}
