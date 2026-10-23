/**
 * Reordering a playlist: the positions the order endpoint takes.
 *
 * The playlist page keeps the entries it read and, while the reader reorders
 * them, a second list in the new order. The endpoint takes the playlist's
 * current zero-based positions in the new order, so the new list is turned back
 * into those positions here. An unchanged order yields nothing to send, which
 * lets the page close reorder mode without a pointless write.
 */

/**
 * Turns a reordered list back into the playlist's current positions.
 *
 * @param originalIds The playlist's entries in the order the server stored.
 * @param orderedIds The same entries after reordering.
 * @returns The positions in their new order, or `null` when the order did not
 *   change or the two lists do not name the same entries.
 */
export function changedOrder(
  originalIds: readonly string[],
  orderedIds: readonly string[]
): number[] | null {
  if (orderedIds.length !== originalIds.length) {
    return null;
  }
  const positions = new Map(originalIds.map((id, index) => [id, index]));
  const order: number[] = [];
  for (const id of orderedIds) {
    const position = positions.get(id);
    if (position === undefined) {
      return null;
    }
    order.push(position);
  }
  return order.every((position, index) => position === index) ? null : order;
}
