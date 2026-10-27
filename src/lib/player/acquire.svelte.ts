/**
 * The acquisition flow of one track.
 *
 * Playing a track that is not on the server asks the acquisition layer for it
 * and then follows the work until the track is playable. The flow is a small
 * state machine over the server's events: a request that already completed is
 * playable at once, the acquisition ledger drives the progress label, and the
 * availability of the track - or of the id the acquisition targeted - ends the
 * wait with the id to play.
 *
 * A failure ends the flow where it is: the caller decides whether to start
 * something else, and the queue does not skip a track the user never heard. A
 * request the server parked for want of an acquisition source keeps waiting
 * instead, with the cause the server named (UR1): nothing failed, so nothing is
 * reported to the caller.
 */
import type { ServerEvent } from '#lib/stores/events.svelte';
import { failureLabel, progressLabel } from '#lib/labels';
import { SubsonicError } from '#lib/subsonic/client';
import type { VendorApi } from '#lib/subsonic/vendor';
import type {
  AcquisitionEntry,
  AcquisitionState,
  FailureReason,
  ParkReason
} from '#lib/subsonic/types';

/** What the client is doing about a track the user asked to play. */
export type AcquireStatus =
  | { kind: 'idle' }
  | {
      kind: 'waiting';
      requestedId: string;
      acquisitionId: string | null;
      state: AcquisitionState;
      percent: number | null;
      /** Whether the server parked the request for want of a source (UR1). */
      awaitingSource: boolean;
      /** Why it waits, when the server named the cause. */
      parkReason: ParkReason | null;
    }
  | { kind: 'ready'; requestedId: string }
  | { kind: 'failed'; requestedId: string; reason: FailureReason | null };

/** Options of an {@link AcquireFlow}. */
export interface AcquireFlowOptions {
  /** The vendor calls to make. */
  api: VendorApi;
  /**
   * Called once the track is playable.
   *
   * @returns Nothing.
   */
  onReady(): void;
  /**
   * Called with a message when the acquisition failed.
   *
   * @param message The failure text.
   */
  onFailed(message: string): void;
}

/**
 * Reads the failure reason out of a rejected request.
 *
 * A Hearthsound server names the stored reason in the refusal, which tells a
 * spent daily quota from a missing permission. A client that gets none falls
 * back to the code, where 50 covers both; anything that is not a Subsonic
 * answer at all means the server could not be reached.
 *
 * @param error The error the call threw.
 * @returns The reason, or `null` when the failure names none.
 */
function reasonOf(error: unknown): FailureReason | null {
  if (error instanceof SubsonicError) {
    if (error.reason !== null) {
      return error.reason;
    }
    return error.code === 50 ? 'permission-denied' : null;
  }
  return 'backend-unavailable';
}

/** The acquisition flow of the current track. */
export class AcquireFlow {
  /** Where the flow is. */
  status = $state<AcquireStatus>({ kind: 'idle' });

  readonly #api: VendorApi;
  readonly #onReady: () => void;
  readonly #onFailed: (message: string) => void;

  /**
   * The request the flow is answering, bumped by every new request and by
   * `clear`.
   *
   * An answer that arrives after either one has happened belongs to a question
   * the user no longer asks, so it is dropped instead of replacing the state.
   */
  #generation = 0;

  /**
   * Builds a flow.
   *
   * @param options The calls to make and the callbacks to report through.
   */
  constructor(options: AcquireFlowOptions) {
    this.#api = options.api;
    this.#onReady = options.onReady;
    this.#onFailed = options.onFailed;
  }

  /** The id the flow is working on, or `null` while it is idle. */
  get requestedId(): string | null {
    return this.status.kind === 'idle' ? null : this.status.requestedId;
  }

  /** The label of what is happening, or `null` while the flow is idle. */
  get label(): string | null {
    const status = this.status;
    if (status.kind === 'idle') {
      return null;
    }
    if (status.kind === 'ready') {
      return 'Ready';
    }
    if (status.kind === 'failed') {
      return status.reason === 'cancelled'
        ? progressLabel({ state: 'cancelled' })
        : progressLabel({ state: 'failed', failureReason: status.reason });
    }
    return progressLabel({
      state: status.state,
      percent: status.percent,
      awaitingSource: status.awaitingSource,
      parkReason: status.parkReason
    });
  }

  /** Why the flow failed, or `null` while it has not failed. */
  get failureReason(): FailureReason | null {
    return this.status.kind === 'failed' ? this.status.reason : null;
  }

  /**
   * Asks for a track and follows it until it is playable.
   *
   * A row that is already terminal ends the flow at once: a track that is
   * cooling down, or one whose attempt was cancelled, never publishes another
   * transition, so waiting for one would leave the pill saying that sources are
   * still being searched.
   *
   * @param id The id the user asked to play.
   * @param retry Whether the user asked again, which ignores the track's
   *   cooldown (E-G-1).
   * @returns Nothing.
   */
  async request(id: string, retry = false): Promise<void> {
    const generation = ++this.#generation;
    this.status = {
      kind: 'waiting',
      requestedId: id,
      acquisitionId: null,
      state: 'searching',
      percent: null,
      awaitingSource: false,
      parkReason: null
    };
    let rows: AcquisitionEntry[];
    try {
      rows = await this.#api.acquire([id], 'play', retry);
    } catch (error) {
      if (generation !== this.#generation || this.status.kind !== 'waiting') {
        return;
      }
      this.#fail(id, reasonOf(error));
      return;
    }
    if (generation !== this.#generation || this.status.kind !== 'waiting') {
      return;
    }
    const row = rows.find((entry) => entry.targetId === id) ?? rows[0];
    if (row === undefined) {
      return;
    }
    if (row.state === 'failed' || row.state === 'cancelled') {
      this.#fail(id, row.failureReason ?? (row.state === 'cancelled' ? 'cancelled' : null));
      return;
    }
    if (row.state === 'completed') {
      this.#ready(id);
      return;
    }
    this.status = {
      kind: 'waiting',
      requestedId: id,
      acquisitionId: row.id,
      state: row.state,
      percent: row.percent ?? null,
      awaitingSource: row.awaitingSource === true,
      parkReason: row.parkReason ?? null
    };
  }

  /**
   * Applies one server event.
   *
   * @param event The event to apply.
   * @returns Nothing.
   */
  apply(event: ServerEvent): void {
    const status = this.status;
    if (status.kind !== 'waiting') {
      return;
    }
    if (event.type === 'acquisition.updated') {
      const matched =
        status.acquisitionId !== null
          ? event.data.acquisitionId === status.acquisitionId
          : event.data.targetId === status.requestedId;
      if (!matched) {
        return;
      }
      if (event.data.state === 'completed') {
        this.#ready(status.requestedId);
        return;
      }
      if (event.data.state === 'failed' || event.data.state === 'cancelled') {
        this.#fail(status.requestedId, event.data.failureReason ?? null);
        return;
      }
      this.status = {
        ...status,
        acquisitionId: event.data.acquisitionId,
        state: event.data.state,
        percent: event.data.percent ?? null,
        awaitingSource: event.data.awaitingSource === true,
        parkReason: event.data.parkReason ?? null
      };
      return;
    }
    if (event.type === 'track.availability' && event.data.trackId === status.requestedId) {
      if (event.data.availability === 'local' || event.data.availability === 'cached') {
        this.#ready(status.requestedId);
      }
    }
  }

  /**
   * Replaces the event state with what the server reports now.
   *
   * After a lost event the client no longer knows whether the track became
   * playable, so it asks the server instead of waiting for a transition that
   * may already have happened.
   *
   * @returns Nothing.
   */
  async resync(): Promise<void> {
    const status = this.status;
    if (status.kind !== 'waiting') {
      return;
    }
    const generation = this.#generation;
    let entries;
    try {
      entries = await this.#api.getAvailability([status.requestedId]);
    } catch {
      return;
    }
    if (generation !== this.#generation || this.status.kind !== 'waiting') {
      return;
    }
    for (const entry of entries) {
      if (entry.state === 'local' || entry.state === 'cached') {
        this.#ready(status.requestedId);
        return;
      }
    }
  }

  /**
   * Ends the flow without reporting anything.
   *
   * A request already in flight is dropped rather than applied when it
   * answers, so a clear really does stop the acquisition.
   *
   * @returns Nothing.
   */
  clear(): void {
    this.#generation += 1;
    this.status = { kind: 'idle' };
  }

  /**
   * Ends the flow as playable.
   *
   * @param requestedId The id the user asked to play.
   * @returns Nothing.
   */
  #ready(requestedId: string): void {
    this.status = { kind: 'ready', requestedId };
    this.#onReady();
  }

  /**
   * Ends the flow as failed.
   *
   * A cancellation is not reported to the user as a failure, because the user
   * asked for it.
   *
   * @param requestedId The id the user asked to play.
   * @param reason Why the acquisition failed.
   * @returns Nothing.
   */
  #fail(requestedId: string, reason: FailureReason | null): void {
    this.status = { kind: 'failed', requestedId, reason };
    if (reason !== 'cancelled') {
      this.#onFailed(failureLabel(reason));
    }
  }
}
