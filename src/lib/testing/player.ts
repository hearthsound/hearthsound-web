/**
 * Test doubles for the player: an audio element and the vendor calls.
 */
import type { AudioLike } from '#lib/player/audio';
import type { VendorApi } from '#lib/subsonic/vendor';
import type { AcquisitionEntry, AvailabilityEntry, PlayQueue, Priority } from '#lib/subsonic/types';

/** An audio element a test drives by hand. */
export class FakeAudio implements AudioLike {
  src = '';

  currentTime = 0;

  duration = Number.NaN;

  paused = true;

  volume = 1;

  muted = false;

  /** How often playback was started. */
  playCount = 0;

  /** How often the element was told to pause. */
  pauseCount = 0;

  /** What `canPlayType` answers. */
  playable = 'probably';

  readonly #listeners = new Map<string, ((event: Event) => void)[]>();

  /**
   * Reports what the fake claims to play.
   *
   * @returns The fake's answer for every type.
   */
  canPlayType(): string {
    return this.playable;
  }

  /** Starts playback. */
  play(): void {
    this.playCount += 1;
    this.paused = false;
    this.emit('play');
  }

  /** Pauses playback. */
  pause(): void {
    this.pauseCount += 1;
    this.paused = true;
    this.emit('pause');
  }

  /**
   * Registers a listener for a media event.
   *
   * @param type The event name.
   * @param listener The listener to call.
   */
  addEventListener(type: string, listener: (event: Event) => void): void {
    const listeners = this.#listeners.get(type) ?? [];
    listeners.push(listener);
    this.#listeners.set(type, listeners);
  }

  /**
   * Delivers one media event.
   *
   * @param type The event name.
   * @returns Nothing.
   */
  emit(type: string): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(new Event(type));
    }
  }
}

/** The vendor calls a test scripts and inspects. */
export class FakeVendor implements VendorApi {
  /** The entries every availability read answers with. */
  availability: AvailabilityEntry[] = [];

  /** The rows every acquire answers with. */
  acquisitions: AcquisitionEntry[] = [];

  /** The queue declarations that were sent. */
  declarations: { current: string; next: string[]; client: string }[] = [];

  /** The ids every availability read asked about. */
  availabilityReads: string[][] = [];

  /** The ids every acquire asked about, with its priority and retry flag. */
  acquireRequests: { ids: string[]; priority: Priority; retry?: boolean }[] = [];

  /** The queue saves that were sent. */
  savedQueues: { ids: string[]; current: string | null; positionMs: number }[] = [];

  /** The scrobbles that were sent. */
  scrobbles: { id: string; submission: boolean }[] = [];

  /** The error every read and request throws, when the tests set one. */
  failure: unknown = null;

  /** The error queue saves throw, when a test scripts one. */
  saveQueueFailure: unknown = null;

  /** The queue `readSavedQueue` answers with. */
  savedQueue: PlayQueue | null = null;

  /**
   * Whether acquire holds its answer until {@link FakeVendor.releaseAcquire}.
   *
   * Two requests can then be in flight at once, which is what the race between
   * a superseded answer and the current one needs.
   */
  hold = false;

  /** The held requests, oldest first. */
  readonly #held: {
    ids: string[];
    resolve(rows: AcquisitionEntry[]): void;
    reject(error: unknown): void;
  }[] = [];

  /**
   * Answers with the scripted availability.
   *
   * @param ids The ids asked about.
   * @returns The scripted entries.
   */
  async getAvailability(ids: readonly string[]): Promise<AvailabilityEntry[]> {
    this.availabilityReads.push([...ids]);
    if (this.failure !== null) {
      throw this.failure;
    }
    return this.availability;
  }

  /**
   * Answers with the scripted acquisitions.
   *
   * @param ids The ids asked to be acquired.
   * @param priority The priority of the request.
   * @param retry Whether the caller asked to ignore a cooldown.
   * @returns The scripted rows.
   */
  async acquire(
    ids: readonly string[],
    priority: Priority,
    retry = false
  ): Promise<AcquisitionEntry[]> {
    this.acquireRequests.push({ ids: [...ids], priority, ...(retry ? { retry } : {}) });
    if (this.hold) {
      const held = Promise.withResolvers<AcquisitionEntry[]>();
      this.#held.push({ ids: [...ids], resolve: held.resolve, reject: held.reject });
      return held.promise;
    }
    if (this.failure !== null) {
      throw this.failure;
    }
    return this.acquisitions;
  }

  /**
   * Answers one held acquisition request with what is scripted now.
   *
   * @param id The id whose request to answer; the oldest one when absent.
   * @returns Nothing.
   */
  releaseAcquire(id?: string): void {
    const at = id === undefined ? 0 : this.#held.findIndex((entry) => entry.ids.includes(id));
    if (at < 0) {
      return;
    }
    const [held] = this.#held.splice(at, 1);
    if (held === undefined) {
      return;
    }
    if (this.failure !== null) {
      held.reject(this.failure);
      return;
    }
    held.resolve(this.acquisitions);
  }

  /**
   * Records a queue declaration.
   *
   * @param current The track being played.
   * @param next The upcoming tracks.
   * @param client The client that owns the queue.
   * @returns Nothing.
   */
  async setQueue(current: string, next: readonly string[], client: string): Promise<void> {
    this.declarations.push({ current, next: [...next], client });
  }

  /**
   * Records a queue save and throws the scripted failure, when there is one.
   *
   * @param ids The track ids, in play order.
   * @param current The id of the track that was playing, or `null`.
   * @param positionMs How far into it playback was, in milliseconds.
   * @returns Nothing.
   */
  async saveQueue(
    ids: readonly string[],
    current: string | null,
    positionMs: number
  ): Promise<void> {
    this.savedQueues.push({ ids: [...ids], current, positionMs });
    if (this.saveQueueFailure !== null) {
      throw this.saveQueueFailure;
    }
  }

  /**
   * Answers with the scripted saved queue.
   *
   * @returns The queue the account saved, or `null`.
   */
  async readSavedQueue(): Promise<PlayQueue | null> {
    return this.savedQueue;
  }

  /**
   * Records a scrobble.
   *
   * @param id The track's client id.
   * @param submission Whether the play is being recorded.
   * @returns Nothing.
   */
  async scrobble(id: string, submission: boolean): Promise<void> {
    this.scrobbles.push({ id, submission });
  }
}

/** A storage a test can inspect. */
export class FakeStorage {
  readonly #values = new Map<string, string>();

  /** How many values are stored, as `localStorage.length` reports it. */
  get length(): number {
    return this.#values.size;
  }

  /**
   * Reads a stored value.
   *
   * @param key The key to read.
   * @returns The value, or `null`.
   */
  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  /**
   * Reads the key at one position, as `localStorage.key` reports it.
   *
   * @param index The position to read.
   * @returns The key, or `null` past the end.
   */
  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  /**
   * Stores a value.
   *
   * @param key The key to write.
   * @param value The value to store.
   * @returns Nothing.
   */
  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }

  /**
   * Removes a stored value.
   *
   * @param key The key to remove.
   * @returns Nothing.
   */
  removeItem(key: string): void {
    this.#values.delete(key);
  }
}
