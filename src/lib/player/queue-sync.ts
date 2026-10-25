/**
 * The server's copy of the queue this tab is playing (E-L-1).
 *
 * Every structural change of the queue is written to the server with a
 * debounce, so a queue that changes five times in a second reaches it once,
 * and a position that keeps ticking never does. The shape is the one the local
 * snapshot keeps (`limitStoredPlayback`), so the two copies say the same thing
 * and a restore from either shows the same queue.
 *
 * A failed save is deliberately quiet: the local snapshot is still there, and
 * the next change sends the whole queue again.
 */
import type { VendorApi } from '#lib/subsonic/vendor';

import type { QueueItem } from './queue.svelte';
import { limitStoredPlayback } from './restore';

/** How long a change waits before the queue is written to the server. */
export const SAVE_QUEUE_DEBOUNCE_MS = 2000;

/** What the sync saves: the queue as the player holds it now. */
export interface SavedQueueSource {
  /** The queue, in play order. */
  items: readonly QueueItem[];
  /** The index of the track that was playing, or `-1` for none. */
  currentIndex: number;
  /** How far into that track playback was, in seconds. */
  positionSecs: number;
  /** The order shuffle replaced, or `null`. */
  original: readonly QueueItem[] | null;
}

/** Options of a {@link SavedQueueSync}. */
export interface SavedQueueSyncOptions {
  /** The calls to make. */
  api: Pick<VendorApi, 'saveQueue'>;
  /**
   * Returns the queue to save.
   *
   * @returns The queue as it is when the save runs, not when it was scheduled.
   */
  get(): SavedQueueSource;
}

/** Writes the playing queue to the server, one save per quiet period. */
export class SavedQueueSync {
  readonly #api: Pick<VendorApi, 'saveQueue'>;
  readonly #get: () => SavedQueueSource;
  #timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Builds the sync.
   *
   * @param options The calls to make and the queue to read.
   */
  constructor(options: SavedQueueSyncOptions) {
    this.#api = options.api;
    this.#get = options.get;
  }

  /** Schedules a save for {@link SAVE_QUEUE_DEBOUNCE_MS} from now. */
  schedule(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      void this.#save();
    }, SAVE_QUEUE_DEBOUNCE_MS);
  }

  /**
   * Saves at once when a save is waiting.
   *
   * The page may go away before the debounce fires, and a hidden page may be
   * frozen, so both write what is pending instead of waiting.
   */
  flush(): void {
    if (this.#timer === undefined) {
      return;
    }
    clearTimeout(this.#timer);
    this.#timer = undefined;
    void this.#save();
  }

  /** Writes the current queue to the server, swallowing a failed save. */
  async #save(): Promise<void> {
    const source = this.#get();
    const saved = limitStoredPlayback({
      items: [...source.items],
      currentIndex: source.currentIndex,
      positionSecs: source.positionSecs,
      original: source.original === null ? null : [...source.original]
    });
    const ids = saved.items.map((item) => item.id);
    const current = saved.items[saved.currentIndex]?.id ?? null;
    try {
      await this.#api.saveQueue(ids, current, Math.round(saved.positionSecs * 1000));
    } catch {
      // The local snapshot keeps the queue, and the next change sends it again.
    }
  }
}
