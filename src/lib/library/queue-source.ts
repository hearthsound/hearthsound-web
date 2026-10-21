/**
 * Reads a whole collection as a queue.
 *
 * The Play, Shuffle and play-from-row actions queue the collection the view
 * shows, not the pages the browser happens to have loaded. The server answers
 * the whole collection in one call (`GET /api/v1/library/queue`), in the
 * collection's own order, and names the position of the row that was picked, so
 * a library of thousands of tracks plays in full from the first click.
 *
 * The queue keeps the collection's order; Shuffle is the player's own state, so
 * turning it off restores that order (queue-order).
 */
import type { QueueItem } from '#lib/player/queue.svelte';
import { nativeClient } from '#lib/api/native';

/** The collections the queue endpoint serves. */
export type QueueSource =
  | 'songs'
  | 'liked'
  | 'uploads'
  | `playlist:${string}`
  | `album:${string}`
  | `artist:${string}`
  | `artist-top:${string}`;

/** One item of the server's answer. */
interface QueueItemView {
  id: string;
  title: string;
  artist?: string | null;
  album?: string | null;
  duration?: number | null;
  coverArt: string;
  availability: string;
  rating?: number | null;
  liked: boolean;
  disliked: boolean;
}

/** The server's answer. */
interface QueueView {
  items: QueueItemView[];
  startIndex: number;
  source: string;
}

/** A collection as the player takes it. */
export interface CollectionQueue {
  /** Every track of the collection, in its own order. */
  items: QueueItem[];
  /** The position to start at. */
  startIndex: number;
}

/**
 * Reads a whole collection.
 *
 * @param source The collection to read.
 * @param from The track to start at, when a row was picked rather than the head.
 * @returns The collection's items and start position, or `null` when the server
 *   refused (for example a collection the caller may not see).
 */
export async function loadCollection(
  source: QueueSource,
  from?: string
): Promise<CollectionQueue | null> {
  const answer = await nativeClient.GET('/api/v1/library/queue', {
    params: { query: { source, from } }
  });
  if (answer.data === undefined) {
    return null;
  }
  const view: QueueView = answer.data;
  // A collection read from an album or an artist names that entity for every
  // item, so the now-playing song menu can lead back to it. A playlist and a
  // library list name neither.
  const [kind, collectionId] = source.split(':', 2);
  const albumId = kind === 'album' ? (collectionId ?? null) : null;
  const artistId = kind === 'artist' || kind === 'artist-top' ? (collectionId ?? null) : null;
  return {
    items: view.items.map((item) => ({
      id: item.id,
      title: item.title,
      artist: item.artist ?? null,
      album: item.album ?? null,
      albumId,
      artistId,
      coverArt: item.coverArt,
      durationSecs: item.duration ?? null,
      liked: item.liked,
      disliked: item.disliked,
      rating: item.rating ?? 0
    })),
    startIndex: view.startIndex
  };
}
