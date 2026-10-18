/**
 * The player's per-item prefetch state.
 *
 * The queue page answers "what is the server doing about this item" from three
 * sources: the scheduler's look-ahead decision, the acquisition ledger, and the
 * availability of the track itself. This tracker folds them into one state per
 * track id, so the page renders a label from {@link prefetchLabel} and nothing
 * else has to know about the events.
 */
import type { ServerEvent } from '#lib/stores/events.svelte';
import type {
  AcquisitionState,
  Availability,
  AvailabilityEntry,
  PrefetchDecision
} from '#lib/subsonic/types';

/** What is known about one queue item's look-ahead acquisition. */
export interface PrefetchState {
  /** The track's availability, when the server reported one. */
  availability: Availability | null;
  /** The acquisition that is running for the track, when one is. */
  acquisitionId: string | null;
  /** The acquisition's state, when one is running. */
  state: AcquisitionState | null;
  /** The download percentage, when one is known. */
  percent: number | null;
  /** What the scheduler answered for the track, when it announced anything. */
  prefetch: PrefetchDecision | null;
}

/** The state of a track nothing is known about. */
export const UNKNOWN_PREFETCH: PrefetchState = {
  availability: null,
  acquisitionId: null,
  state: null,
  percent: null,
  prefetch: null
};

/** The prefetch state of the tracks of one client. */
export class PrefetchTracker {
  /** The state of every track the client heard about, by track id. */
  states = $state<Record<string, PrefetchState>>({});

  readonly #client: string;

  /**
   * Builds a tracker for one client instance.
   *
   * @param client The client instance whose queue declarations the tracker
   *   listens to.
   */
  constructor(client: string) {
    this.#client = client;
  }

  /**
   * Returns the state of a track.
   *
   * @param trackId The track's client id.
   * @returns The known state, or the unknown state for an id nothing was heard
   *   about.
   */
  stateFor(trackId: string): PrefetchState {
    return this.states[trackId] ?? UNKNOWN_PREFETCH;
  }

  /**
   * Records what an availability read reported.
   *
   * The read names the acquisition that is running, when one is, so an entry
   * without one clears the acquisition the tracker knew: nothing is running for
   * the track.
   *
   * @param entries The availability entries, in request order.
   * @returns Nothing.
   */
  adopt(entries: readonly AvailabilityEntry[]): void {
    const states = { ...this.states };
    for (const entry of entries) {
      const known = states[entry.id] ?? UNKNOWN_PREFETCH;
      const acquisitionId = entry.acquisitionId ?? null;
      states[entry.id] = {
        ...known,
        availability: entry.state,
        acquisitionId,
        state: acquisitionId === null ? null : known.state,
        percent: entry.percent ?? (acquisitionId === null ? null : known.percent)
      };
    }
    this.states = states;
  }

  /**
   * Applies one server event.
   *
   * @param event The event to apply.
   * @returns Nothing.
   */
  apply(event: ServerEvent): void {
    if (event.type === 'queue.prefetch') {
      if (event.data.client === this.#client) {
        this.#set(event.data.trackId, (known) =>
          event.data.state === 'started'
            ? { ...known, prefetch: 'started' }
            : { ...known, prefetch: 'dropped', state: null, percent: null }
        );
      }
      return;
    }
    if (event.type === 'acquisition.updated') {
      const trackId = this.#trackOf(event.data.acquisitionId, event.data.targetId);
      if (trackId !== null) {
        this.#set(trackId, (known) => ({
          ...known,
          acquisitionId: event.data.acquisitionId,
          state: event.data.state,
          percent: event.data.percent ?? null
        }));
      }
      return;
    }
    if (event.type === 'track.availability') {
      const playable = event.data.availability === 'local' || event.data.availability === 'cached';
      this.#set(event.data.trackId, (known) => ({
        ...known,
        availability: event.data.availability,
        acquisitionId: playable ? null : known.acquisitionId,
        state: playable ? null : known.state,
        percent: playable ? null : known.percent
      }));
    }
  }

  /**
   * Finds the track an acquisition belongs to.
   *
   * @param acquisitionId The acquisition's client id.
   * @param targetId The client id of the entity being acquired, which is the
   *   track itself while the acquisition targets a stored track.
   * @returns The track id, or `null` when the acquisition belongs to no track
   *   the tracker knows.
   */
  #trackOf(acquisitionId: string, targetId: string): string | null {
    const byAcquisition = Object.keys(this.states).find(
      (trackId) => this.states[trackId].acquisitionId === acquisitionId
    );
    if (byAcquisition !== undefined) {
      return byAcquisition;
    }
    return targetId in this.states ? targetId : null;
  }

  /**
   * Replaces the state of one track.
   *
   * @param trackId The track's client id.
   * @param update The change to apply to the known state.
   * @returns Nothing.
   */
  #set(trackId: string, update: (known: PrefetchState) => PrefetchState): void {
    const known = this.states[trackId] ?? UNKNOWN_PREFETCH;
    this.states = { ...this.states, [trackId]: update(known) };
  }
}
