/**
 * The track conversion the views and the player share.
 *
 * The Subsonic entities the server projects carry more than the player needs;
 * a queue item is what one track of the queue is, so the conversion happens
 * once, here, instead of in every view that starts playback.
 */
import type { QueueItem } from './queue.svelte';
import type { Child } from '#lib/subsonic/types';

/**
 * Converts a track into a queue item.
 *
 * A track without a title falls back to its name, and one without either keeps
 * an empty title rather than the word "undefined".
 *
 * @param track The track, as a browse endpoint reported it.
 * @returns The queue item.
 */
export function queueItemOf(track: Child): QueueItem {
  return {
    id: track.id,
    title: track.title ?? track.name ?? '',
    artist: track.artist ?? null,
    album: track.album ?? null,
    albumId: track.albumId ?? null,
    artistId: track.artistId ?? null,
    albumPath: track.hearthsound?.albumPath ?? null,
    artistPath: track.hearthsound?.artistPath ?? null,
    coverArt: track.coverArt ?? null,
    contentType: track.contentType ?? null,
    durationSecs: track.duration ?? null,
    liked: track.starred !== undefined,
    disliked: track.hearthsound?.disliked === true,
    rating: track.userRating ?? 0
  };
}
