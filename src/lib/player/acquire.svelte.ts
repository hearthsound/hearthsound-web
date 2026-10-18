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
 * something else, and the queue does not skip a track the user never heard.
 */
import type { ServerEvent } from '#lib/stores/events.svelte';
import { failureLabel, progressLabel } from '#lib/labels';
import { SubsonicError } from '#lib/subsonic/client';
import type { VendorApi } from '#lib/subsonic/vendor';
import type { AcquisitionEntry, AcquisitionState, FailureReason } from '#lib/subsonic/types';

/** What the client is doing about a track the user asked to play. */
export type AcquireStatus =
  | { kind: 'idle' }
  | {
      kind: 'waiting';
      requestedId: string;
      targetId: string;
      acquisitionId: string | null;
      state: AcquisitionState;
      percent: number | null;
    }
  | { kind: 'ready'; requestedId: string; playId: string }
  | { kind: 'failed'; requestedId: string; reason: FailureReason | null };

/** Options of an {@link AcquireFlow}. */
export interface AcquireFlowOptions {
  /** The vendor calls to make. */
  api: VendorApi;
  /**
   * Called with the id to play once the track is playable.
   *
   * @param playId The id the stream can be read from.
   */
  onReady(playId: string): void;
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
 * A refused acquisition is reported by the Subsonic surface as error 50, which
 * covers both the missing permission and a spent quota; anything that is not a
 * Subsonic answer at all means the server could not be reached.
 *
 * @param error The error the call threw.
 * @returns The reason, or `null` when the failure names none.
 */
function reasonOf(error: unknown): FailureReason | null {
  if (error instanceof SubsonicError) {
    return error.code === 50 ? 'permission-denied' : null;
  }
  return 'backend-unavailable';
}

/** The acquisition flow of the current track. */
export class AcquireFlow {
  /** Where the flow is. */
  status = $state<AcquireStatus>({ kind: 'idle' });

  readonly #api: VendorApi;
  readonly #onReady: (playId: string) => void;
  readonly #onFailed: (message: string) => void;

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
    return progressLabel({ state: status.state, percent: status.percent });
  }

  /**
   * Asks for a track and follows it until it is playable.
   *
   * @param id The id the user asked to play, which may be a catalog id.
   * @returns Nothing.
   */
  async request(id: string): Promise<void> {
    this.status = {
      kind: 'waiting',
      requestedId: id,
      targetId: id,
      acquisitionId: null,
      state: 'searching',
      percent: null
    };
    let rows: AcquisitionEntry[];
    try {
      rows = await this.#api.acquire([id], 'play');
    } catch (error) {
      this.#fail(id, reasonOf(error));
      return;
    }
    const row = rows.find((entry) => entry.targetId === id) ?? rows[0];
    if (row === undefined || this.status.kind !== 'waiting') {
      return;
    }
    if (row.state === 'completed') {
      this.#ready(id, row.targetId);
      return;
    }
    this.status = {
      kind: 'waiting',
      requestedId: id,
      targetId: row.targetId,
      acquisitionId: row.id,
      state: row.state,
      percent: row.percent ?? null
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
          : event.data.targetId === status.targetId || event.data.targetId === status.requestedId;
      if (!matched) {
        return;
      }
      if (event.data.state === 'completed') {
        this.#ready(status.requestedId, event.data.targetId);
        return;
      }
      if (event.data.state === 'failed' || event.data.state === 'cancelled') {
        this.#fail(status.requestedId, event.data.failureReason ?? null);
        return;
      }
      this.status = {
        ...status,
        targetId: event.data.targetId,
        acquisitionId: event.data.acquisitionId,
        state: event.data.state,
        percent: event.data.percent ?? null
      };
      return;
    }
    if (
      event.type === 'track.availability' &&
      (event.data.trackId === status.targetId || event.data.trackId === status.requestedId)
    ) {
      if (event.data.availability === 'local' || event.data.availability === 'cached') {
        this.#ready(status.requestedId, event.data.trackId);
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
    const ids =
      status.targetId === status.requestedId
        ? [status.requestedId]
        : [status.requestedId, status.targetId];
    let entries;
    try {
      entries = await this.#api.getAvailability(ids);
    } catch {
      return;
    }
    if (this.status.kind !== 'waiting') {
      return;
    }
    for (const entry of entries) {
      if (entry.state === 'local' || entry.state === 'cached') {
        this.#ready(status.requestedId, entry.id);
        return;
      }
    }
  }

  /**
   * Ends the flow without reporting anything.
   *
   * @returns Nothing.
   */
  clear(): void {
    this.status = { kind: 'idle' };
  }

  /**
   * Ends the flow as playable.
   *
   * @param requestedId The id the user asked to play.
   * @param playId The id the track can be streamed from.
   * @returns Nothing.
   */
  #ready(requestedId: string, playId: string): void {
    this.status = { kind: 'ready', requestedId, playId };
    this.#onReady(playId);
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
