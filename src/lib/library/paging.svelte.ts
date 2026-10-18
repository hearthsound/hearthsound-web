/**
 * The paging a list view shares.
 *
 * Every long list loads one page at a time through a "Load more" control
 * instead of growing as the reader scrolls. A page carries the rows it holds
 * and the cursor of the one after it, so the same list serves a read that pages
 * by offset and one that follows an opaque cursor, and the rules - append,
 * stop at the last page, keep what was read when a read fails - are stated once
 * here.
 */

/** One page of a paged list. */
export interface Page<T, C> {
  /** The rows of the page, in the order the server answered them. */
  items: T[];
  /** The cursor of the next page, or `null` when this was the last page. */
  next: C | null;
}

/**
 * Reads one page.
 *
 * @param cursor The cursor of the page to read, or `null` for the first one.
 * @returns The page.
 */
export type PageLoader<T, C> = (cursor: C | null) => Promise<Page<T, C>>;

/** A list a view fills one page at a time. */
export class PagedList<T, C = number> {
  /** The rows read so far, in order. */
  items = $state<T[]>([]);

  /** Whether a page is being read right now. */
  loading = $state(false);

  /** Whether the last page has been read. */
  done = $state(false);

  /** The message to show when a read failed, or `null`. */
  failure = $state<string | null>(null);

  #loader: PageLoader<T, C> | null = null;
  #cursor: C | null = null;
  #generation = 0;

  /**
   * Starts the list over and reads its first page.
   *
   * A read that is still running for the previous list is dropped when it
   * answers, so a view that switches to another list never shows both.
   *
   * @param loader The read to make, from the first page on.
   * @returns Nothing.
   */
  start(loader: PageLoader<T, C>): void {
    this.#loader = loader;
    this.#generation += 1;
    this.#cursor = null;
    this.items = [];
    this.loading = false;
    this.done = false;
    this.failure = null;
    void this.loadMore();
  }

  /**
   * Reads the next page and appends it.
   *
   * A list without a loader, a read that is already running and a finished list
   * all do nothing. A failed read keeps the rows that were read and leaves the
   * list open, so the same call can try again.
   *
   * @returns Nothing.
   */
  async loadMore(): Promise<void> {
    const loader = this.#loader;
    if (loader === null || this.loading || this.done) {
      return;
    }
    const generation = this.#generation;
    this.loading = true;
    this.failure = null;
    try {
      const page = await loader(this.#cursor);
      if (generation !== this.#generation) {
        return;
      }
      this.items = [...this.items, ...page.items];
      this.#cursor = page.next;
      this.done = page.next === null;
    } catch (error) {
      if (generation !== this.#generation) {
        return;
      }
      this.failure = error instanceof Error ? error.message : 'The list could not be read.';
    } finally {
      if (generation === this.#generation) {
        this.loading = false;
      }
    }
  }
}
