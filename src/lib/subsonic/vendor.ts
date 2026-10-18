/**
 * The Subsonic vendor calls the client drives on its own.
 *
 * Every call opts into the `hearthsound` vendor extension, which is what the
 * transport already does for the whole client. Reads answer with the state the
 * player and the queue render; the queue declaration is what lets the server's
 * prefetch scheduler look ahead, and the scrobble reports start and play.
 */
import { subsonic } from './client';
import type {
  AcquisitionEntry,
  AcquisitionsResponse,
  AvailabilityEntry,
  AvailabilityResponse,
  Priority
} from './types';

/** The vendor calls the client makes. */
export interface VendorApi {
  /**
   * Reads the availability and the active acquisition of the named entities.
   *
   * @param ids The track ids to ask about.
   * @returns One entry per id the server knows, in request order.
   */
  getAvailability(ids: readonly string[]): Promise<AvailabilityEntry[]>;
  /**
   * Asks for the named entities to be acquired.
   *
   * @param ids The ids to acquire.
   * @param priority The scheduling priority of the request.
   * @returns The acquisition of each id, in request order.
   */
  acquire(ids: readonly string[], priority: Priority): Promise<AcquisitionEntry[]>;
  /**
   * Declares the client's queue to the server.
   *
   * @param current The track being played.
   * @param next The upcoming tracks, in order.
   * @param client The client instance that owns the queue.
   * @returns Nothing.
   */
  setQueue(current: string, next: readonly string[], client: string): Promise<void>;
  /**
   * Reports a play, or that a track started playing.
   *
   * @param id The track's client id.
   * @param submission `false` reports that the track started, `true` records the
   *   play.
   * @returns Nothing.
   */
  scrobble(id: string, submission: boolean): Promise<void>;
}

/** The vendor calls, made against the Subsonic surface. */
export const vendor: VendorApi = {
  async getAvailability(ids) {
    const answer = await subsonic.get<AvailabilityResponse>('hsGetAvailability', {
      id: [...ids]
    });
    return answer.availabilities?.availability ?? [];
  },
  async acquire(ids, priority) {
    const answer = await subsonic.post<AcquisitionsResponse>('hsAcquire', {
      id: [...ids],
      priority
    });
    return answer.acquisitions?.acquisition ?? [];
  },
  async setQueue(current, next, client) {
    await subsonic.post('hsSetQueue', { current, next: [...next], client });
  },
  async scrobble(id, submission) {
    await subsonic.post('scrobble', { id, submission });
  }
};
