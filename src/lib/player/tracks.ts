/**
 * The track conversion the views and the player share.
 *
 * The entities the APIs return carry more than the player needs; a queue item is
 * what one track of the queue is, so the conversion happens once, here, instead
 * of in every view that starts playback.
 */
import type { Song } from '#lib/library/song';
import type { QueueItem } from './queue.svelte';

/**
 * Converts a track into a queue item.
 *
 * A track without a title falls back to its name, and one without either keeps
 * an empty title rather than the word "undefined".
 *
 * @param track The track, as a list reported it.
 * @returns The queue item.
 */
export function queueItemOf(track: Song): QueueItem {
  return {
    id: track.id,
    title: track.title ?? track.name ?? '',
    artist: track.artist ?? null,
    album: track.album ?? null,
    albumId: track.albumId ?? null,
    artistId: track.artistId ?? null,
    coverArt: track.coverArt ?? null,
    contentType: track.contentType ?? null,
    durationSecs: track.duration ?? null,
    liked: track.liked ?? track.starred !== undefined,
    disliked: track.disliked ?? track.hearthsound?.disliked === true,
    rating: track.userRating ?? 0
  };
}
