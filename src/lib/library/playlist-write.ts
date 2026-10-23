/**
 * The playlist writes the native API takes.
 *
 * Reordering and adding a whole collection are single requests on the native
 * API, which the Subsonic surface cannot express: `updatePlaylist` moves one
 * song at a time. Every refusal is thrown with the sentence the server worded,
 * so the page's own failure toast can show it.
 */
import { nativeClient } from '#lib/api/native';

/** A collection the playlist endpoint appends in one request. */
export type PlaylistSource = `album:${string}` | `playlist:${string}` | `artist:${string}`;

/** What one add request appended. */
export interface PlaylistAddResult {
  /** How many tracks the request appended. */
  added: number;
  /** How many tracks the playlist holds afterwards. */
  trackCount: number;
}

/**
 * Rewrites the order of a playlist's entries.
 *
 * @param id The playlist's client id.
 * @param order The playlist's current positions in their new order.
 * @returns Nothing.
 * @throws Error when the server refused the write.
 */
export async function reorderPlaylist(id: string, order: readonly number[]): Promise<void> {
  const answer = await nativeClient.PUT('/api/v1/playlists/{id}/order', {
    params: { path: { id } },
    body: { order: [...order] }
  });
  if (answer.response.status !== 204) {
    throw new Error(
      answer.error?.detail ?? answer.error?.title ?? 'Could not reorder the playlist.'
    );
  }
}

/**
 * Appends a whole album, playlist or artist to a playlist.
 *
 * @param id The playlist's client id.
 * @param source The collection to append.
 * @returns How many tracks were appended and the playlist's new size.
 * @throws Error when the server refused the write.
 */
export async function addPlaylistSource(
  id: string,
  source: PlaylistSource
): Promise<PlaylistAddResult> {
  const answer = await nativeClient.POST('/api/v1/playlists/{id}/tracks', {
    params: { path: { id } },
    body: { source }
  });
  if (answer.data === undefined) {
    throw new Error(answer.error?.detail ?? answer.error?.title ?? 'Could not add the songs.');
  }
  return answer.data;
}
