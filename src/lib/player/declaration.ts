/**
 * The queue declaration the server's prefetch scheduler works from.
 *
 * The client does not decide what to prefetch: it tells the server which track
 * plays and what follows it, and the server decides. A queue that changes again
 * within the delay is declared once, with its latest shape, so skimming a list
 * does not declare a queue per press. After the declaration lands, the client
 * reads the availability of the first few upcoming items so the queue can show
 * what the scheduler is doing with them.
 */
import type { VendorApi } from '#lib/subsonic/vendor';

import type { PrefetchTracker } from './prefetch.svelte';
import type { QueueStore } from './queue.svelte';

/** The delay before a changed queue is declared, in milliseconds. */
export const QUEUE_DECLARE_DELAY_MS = 500;

/** The delay before a declared queue is checked for running acquisitions. */
export const PREFETCH_DELAY_MS = 1000;

/** How many upcoming items a queue declaration looks ahead at. */
export const PREFETCH_LOOKAHEAD = 3;

/** Options of a {@link QueueDeclaration}. */
export interface QueueDeclarationOptions {
  /** The vendor calls to make. */
  api: VendorApi;
  /** The client instance name the server correlates the queue by. */
  client: string;
  /** The queue to declare. */
  queue: QueueStore;
  /** The prefetch states the look-ahead writes. */
  prefetch: PrefetchTracker;
}

/** Declares one client's queue and keeps its look-ahead current. */
export class QueueDeclaration {
  readonly #api: VendorApi;
  readonly #client: string;
  readonly #queue: QueueStore;
  readonly #prefetch: PrefetchTracker;
  #declareGeneration = 0;
  #lookaheadGeneration = 0;

  /**
   * Builds a declaration.
   *
   * @param options The calls to make, the queue to declare and where the
   *   look-ahead writes.
   */
  constructor(options: QueueDeclarationOptions) {
    this.#api = options.api;
    this.#client = options.client;
    this.#queue = options.queue;
    this.#prefetch = options.prefetch;
  }

  /**
   * Schedules the declaration of the queue as it stands now.
   *
   * A queue that changes again before the delay elapses is declared once, with
   * its latest shape.
   *
   * @returns Nothing.
   */
  schedule(): void {
    const generation = ++this.#declareGeneration;
    setTimeout(() => {
      if (generation === this.#declareGeneration) {
        void this.#declare();
      }
    }, QUEUE_DECLARE_DELAY_MS);
  }

  /**
   * Declares the queue to the server and schedules the look-ahead.
   *
   * A queue with nothing after the current track is not declared: the scheduler
   * has nothing to look ahead at.
   *
   * @returns Nothing.
   */
  async #declare(): Promise<void> {
    const current = this.#queue.current;
    if (current === null) {
      return;
    }
    const next = this.#queue.following.map((item) => item.id);
    if (next.length === 0) {
      return;
    }
    try {
      await this.#api.setQueue(current.id, next, this.#client);
    } catch {
      return;
    }
    const generation = ++this.#lookaheadGeneration;
    setTimeout(() => {
      if (generation === this.#lookaheadGeneration) {
        void this.#lookahead();
      }
    }, PREFETCH_DELAY_MS);
  }

  /**
   * Reads the availability of the upcoming items.
   *
   * @returns Nothing.
   */
  async #lookahead(): Promise<void> {
    const ids = this.#queue.following.slice(0, PREFETCH_LOOKAHEAD).map((item) => item.id);
    if (ids.length === 0) {
      return;
    }
    try {
      this.#prefetch.adopt(await this.#api.getAvailability(ids));
    } catch {
      // The next declaration reads again.
    }
  }
}
