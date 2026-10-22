/**
 * The search field and the address's query.
 *
 * The sidebar field and the results page's own field both follow the one
 * address: `?q=` is the query's home, so a search can be shared, and typing in
 * either field writes the same query back. The rule is subtle - adopt what the
 * address says unless this field is the one that wrote it, so a keystroke
 * typed while the write lands is not overwritten - which is why it lives here,
 * once, instead of in two effects with their own guards.
 *
 * The module holds no address state of its own: a view passes the query it
 * reads and takes back the route to visit.
 */

/** One search field's tie to the address's `q` query. */
export class SearchField {
  /** What the field shows. */
  value = $state('');

  /** The query this field last wrote to the address, while the write lands. */
  #writing: string | null = null;

  /**
   * Builds a field that shows the query the address carried.
   *
   * @param query The address's query, or an empty string.
   */
  constructor(query = '') {
    this.value = query;
  }

  /**
   * Adopts the query the address carries.
   *
   * A query this field itself wrote is not adopted again: the field already
   * holds it, and a keystroke typed while the navigation landed is newer than
   * the address. Nor is a query the field already says once trimmed: the
   * address carries the trimmed query, so adopting it would eat the space the
   * user just typed between two words. Every other address change - the other
   * field, a shared link, Back and Forward - replaces what the field shows.
   *
   * @param query The query the address carries now.
   * @returns Nothing.
   */
  adopt(query: string): void {
    const mine = this.#writing;
    this.#writing = null;
    if (mine !== null && query === mine) {
      return;
    }
    if (this.value.trim() !== query) {
      this.value = query;
    }
  }

  /**
   * Empties the field, so a page outside the results shows its placeholder
   * rather than a query it no longer answers (l14).
   *
   * @returns Nothing.
   */
  clear(): void {
    this.#writing = null;
    if (this.value !== '') {
      this.value = '';
    }
  }

  /**
   * Prepares to write a query to the address.
   *
   * The view visits the returned route replacing the current history entry, so
   * typing does not fill the history with one entry per pause.
   *
   * @param query The trimmed query to publish.
   * @param published The query the address carries now.
   * @returns The route to visit, or `null` when the address already carries
   *   the query.
   */
  publish(query: string, published: string): string | null {
    if (published === query) {
      return null;
    }
    this.#writing = query;
    return `/search?q=${encodeURIComponent(query)}`;
  }
}
