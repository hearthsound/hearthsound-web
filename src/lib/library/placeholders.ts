/**
 * How many placeholders a list draws.
 *
 * The rule is the same for every list: the shimmer stands for the items that
 * are about to arrive, so its number is `min(items in the list, page size)` on
 * the first load and `min(page size, items left)` for each later batch. A list
 * whose total is not known yet draws one page, which is the same formula with
 * an unbounded total.
 */

/**
 * Returns the placeholders of a list's first page.
 *
 * @param total How many items the list holds, or `null` when that is not known.
 * @param pageSize How many items one page holds.
 * @returns The number of placeholders to draw.
 */
export function firstPagePlaceholders(total: number | null, pageSize: number): number {
  if (total === null) {
    return Math.max(0, pageSize);
  }
  return Math.max(0, Math.min(total, pageSize));
}

/**
 * Returns the placeholders of the next page of a list that is loading it.
 *
 * @param total How many items the list holds, or `null` when that is not known.
 * @param loaded How many items the list already shows.
 * @param pageSize How many items one page holds.
 * @returns The number of placeholders to draw: the items the next page will
 * bring, and nothing when the list is already complete.
 */
export function nextPagePlaceholders(
  total: number | null,
  loaded: number,
  pageSize: number
): number {
  if (total === null) {
    return Math.max(0, pageSize);
  }
  return Math.max(0, Math.min(pageSize, total - loaded));
}
