/**
 * The Subsonic vendor calls the client drives on its own.
 *
 * Every call opts into the `hearthsound` vendor extension, which is what the
 * transport already does for the whole client. Reads answer with the state the
 * player and the queue render; the queue declaration is what lets the server's
 * prefetch scheduler look ahead, and the scrobble reports start and play. The
 * saved queue is the server's copy of what this tab is playing, which another
 * device picks up (E-L-1).
 */
import { subsonic } from './client';
import { readPlayQueue, savePlayQueue } from './saved-queue';
import type {
  AcquisitionEntry,
  AcquisitionsResponse,
  AvailabilityEntry,
  AvailabilityResponse,
  PlayQueue,
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
   * @param retry Whether this is the listener asking again, which ignores the
   *   track's cooldown (E-G-1).
   * @returns The acquisition of each id, in request order.
   */
  acquire(ids: readonly string[], priority: Priority, retry?: boolean): Promise<AcquisitionEntry[]>;
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
   * Saves the client's queue on the server (E-L-1).
   *
   * @param ids The track ids, in play order.
   * @param current The id of the track that was playing, or `null` for none.
   * @param positionMs How far into that track playback was, in milliseconds.
   * @returns Nothing.
   */
  saveQueue(ids: readonly string[], current: string | null, positionMs: number): Promise<void>;
  /**
   * Reads the queue the account saved most recently (E-L-1).
   *
   * @returns The saved queue, or `null` when the account never saved one.
   */
  readSavedQueue(): Promise<PlayQueue | null>;
  /**
   * Reports a play, or that a track started playing.
   *
   * @param id The track's client id.
   * @param submission `false` reports that the track started, `true` records the
   *   play.
   * @param startedAtMs When the track started, in unix milliseconds; the server
   *   stamps the request's own time when absent.
   * @returns Nothing.
   */
  scrobble(id: string, submission: boolean, startedAtMs?: number): Promise<void>;
  /**
   * Reports what the player is doing with a track.
   *
   * The OpenSubsonic playback report is what the server's now-playing row is
   * drawn from and what clears it: a `stopped` report removes the row at once,
   * where waiting for the track's duration to pass would leave it there for
   * minutes (A-activity-25).
   *
   * @param report The state, how far into the track it is, and whether the
   *   report may record a play.
   * @returns Nothing.
   */
  reportPlayback(report: PlaybackReport): Promise<void>;
}

/** One OpenSubsonic playback report. */
export interface PlaybackReport {
  /** The track's client id. */
  mediaId: string;
  /** What the player is doing. */
  state: 'starting' | 'playing' | 'stopped';
  /** How far into the track the player is, in milliseconds. */
  positionMs: number;
  /**
   * Whether the report asks the server to record no play.
   *
   * A stop, a pause or a page going away says only that the track is not
   * playing any more; it never earns a play of its own.
   */
  ignoreScrobble: boolean;
}

/** The vendor calls, made against the Subsonic surface. */
export const vendor: VendorApi = {
  async getAvailability(ids) {
    const answer = await subsonic.get<AvailabilityResponse>('hsGetAvailability', {
      id: [...ids]
    });
    return answer.availabilities?.availability ?? [];
  },
  async acquire(ids, priority, retry = false) {
    const answer = await subsonic.post<AcquisitionsResponse>('hsAcquire', {
      id: [...ids],
      priority,
      retry: retry ? 'true' : undefined
    });
    return answer.acquisitions?.acquisition ?? [];
  },
  async setQueue(current, next, client) {
    await subsonic.post('hsSetQueue', { current, next: [...next], client });
  },
  async saveQueue(ids, current, positionMs) {
    await savePlayQueue(ids, current, positionMs);
  },
  async readSavedQueue() {
    return readPlayQueue();
  },
  async scrobble(id, submission, startedAtMs) {
    await subsonic.post('scrobble', { id, submission, time: startedAtMs });
  },
  async reportPlayback(report) {
    await subsonic.post('reportPlayback', {
      mediaId: report.mediaId,
      mediaType: 'song',
      state: report.state,
      positionMs: Math.max(0, Math.round(report.positionMs)),
      ignoreScrobble: report.ignoreScrobble
    });
  }
};
