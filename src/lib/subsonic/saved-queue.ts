/**
 * The saved play queue of the Subsonic surface (E-L-1).
 *
 * `savePlayQueue` stores the client's queue on the server, so another device -
 * or the same one after its local snapshot is gone - can carry on where this
 * one was. `getPlayQueue` answers the most recent save across the account's
 * clients. A save with no ids deletes the stored queue.
 */
import { subsonic } from './client';
import type { PlayQueue, PlayQueueAnswer } from './types';

/**
 * Stores the client's queue on the server.
 *
 * @param ids The track ids, in play order.
 * @param current The id of the track that was playing, or `null` when none was.
 * @param positionMs How far into that track playback was, in milliseconds.
 * @returns Nothing.
 */
export async function savePlayQueue(
  ids: readonly string[],
  current: string | null,
  positionMs: number
): Promise<void> {
  await subsonic.post('savePlayQueue', {
    id: [...ids],
    current: current ?? undefined,
    position: Math.round(positionMs)
  });
}

/**
 * Reads the queue the account saved most recently.
 *
 * @returns The saved queue, or `null` when the account never saved one.
 */
export async function readPlayQueue(): Promise<PlayQueue | null> {
  const answer = await subsonic.get<PlayQueueAnswer>('getPlayQueue');
  return answer.playQueue ?? null;
}
