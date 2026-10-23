/**
 * How large each list of the library is, as the server last reported it.
 *
 * A list view draws its placeholders before it has read a single row, so the
 * placeholder count has to come from somewhere other than the rows: this store
 * holds the server's counts for the caller's scope. The counts are refreshed
 * when the library, a playlist or an upload changes, after a short delay that
 * folds a burst of events into one read.
 */
import { PERSONAL_FOLDER, libraryApi } from '#lib/subsonic/library';
import type { LibraryCounts } from '#lib/subsonic/types';

import type { EventStream } from './events.svelte';
import { events } from './events.svelte';

/** How long a burst of change events is folded before the counts are read. */
const REFRESH_DELAY_MS = 400;

/** The counts the last read reported, and the reads in flight. */
export class LibraryCountsStore {
  /** The counts, or `null` until the first read answers. */
  counts = $state<LibraryCounts | null>(null);

  /** The pending refresh of a burst of events. */
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** The generation of the newest read, so a slow answer cannot win. */
  private generation = 0;

  /**
   * Reads the counts of the caller's personal library.
   *
   * A failed read keeps the counts already held: a view that drew sixty
   * placeholders from the last answer is better off than one that drew none.
   *
   * @returns Nothing.
   */
  async refresh(): Promise<void> {
    const mine = ++this.generation;
    try {
      const counts = await libraryApi.counts(PERSONAL_FOLDER);
      if (mine === this.generation) {
        this.counts = counts;
      }
    } catch {
      // The last answer stands; the next event or visit asks again.
    }
  }

  /** Forgets the counts, which is what signing out does. */
  clear(): void {
    this.generation += 1;
    this.counts = null;
    this.stop();
  }

  /**
   * Refreshes after a change, folding a burst of events into one read.
   *
   * @returns Nothing.
   */
  private schedule(): void {
    this.stop();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, REFRESH_DELAY_MS);
  }

  /** Cancels a scheduled refresh. */
  private stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Refreshes whenever the library, a playlist or an upload changes.
   *
   * @param stream The event stream to follow.
   * @returns A function that stops following.
   */
  follow(stream: EventStream): () => void {
    const schedule = () => this.schedule();
    const stops = [
      stream.on('library.changed', schedule),
      stream.on('playlist.changed', schedule),
      stream.on('upload.updated', schedule)
    ];
    return () => {
      for (const stop of stops) {
        stop();
      }
      this.stop();
    };
  }
}

/** The counts every list view sizes its placeholders with. */
export const libraryCounts = new LibraryCountsStore();

// The counts follow the stream for the life of the page, like the availability
// map and the session: a view that mounts later reads what has been kept.
libraryCounts.follow(events);
