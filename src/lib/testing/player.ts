/**
 * Test doubles for the player: an audio element and the vendor calls.
 */
import type { AudioLike } from '#lib/player/player.svelte';
import type { VendorApi } from '#lib/subsonic/vendor';
import type { AcquisitionEntry, AvailabilityEntry, Priority } from '#lib/subsonic/types';

/** An audio element a test drives by hand. */
export class FakeAudio implements AudioLike {
  src = '';

  currentTime = 0;

  duration = Number.NaN;

  paused = true;

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

  /** The ids every acquire asked about, with its priority. */
  acquireRequests: { ids: string[]; priority: Priority }[] = [];

  /** The scrobbles that were sent. */
  scrobbles: { id: string; submission: boolean }[] = [];

  /** The reads that answer with nothing instead. */
  failing = false;

  /**
   * Answers with the scripted availability.
   *
   * @param ids The ids asked about.
   * @returns The scripted entries.
   */
  async getAvailability(ids: readonly string[]): Promise<AvailabilityEntry[]> {
    this.availabilityReads.push([...ids]);
    if (this.failing) {
      throw new Error('unreachable');
    }
    return this.availability;
  }

  /**
   * Answers with the scripted acquisitions.
   *
   * @param ids The ids asked to be acquired.
   * @param priority The priority of the request.
   * @returns The scripted rows.
   */
  async acquire(ids: readonly string[], priority: Priority): Promise<AcquisitionEntry[]> {
    this.acquireRequests.push({ ids: [...ids], priority });
    if (this.failing) {
      throw new Error('unreachable');
    }
    return this.acquisitions;
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
   * Stores a value.
   *
   * @param key The key to write.
   * @param value The value to store.
   * @returns Nothing.
   */
  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}
