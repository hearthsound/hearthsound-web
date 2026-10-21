/**
 * The state of a shelf's scroll buttons.
 *
 * A shelf hides its buttons when the row fits the window, and disables the one
 * whose end has been reached. The box values are read from the scrolling
 * element, so the same rule serves every shelf.
 */

/** Which ways a shelf can still scroll. */
export interface ShelfEdges {
  /** Whether the row is wider than the window and scrolls at all. */
  overflow: boolean;
  /** Whether cards lie to the left of the visible part. */
  back: boolean;
  /** Whether cards lie to the right of the visible part. */
  forward: boolean;
}

/** Sub-pixel scroll offsets count as the end, so a rounded layout never leaves a dead button. */
const TOLERANCE = 1;

/**
 * Derives a shelf's scroll buttons from its scroll box.
 *
 * @param scrollLeft The row's current horizontal offset.
 * @param scrollWidth The row's full width, including the part out of view.
 * @param clientWidth The visible width of the row.
 * @returns Which buttons the shelf shows, and whether each is usable.
 */
export function shelfEdges(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number
): ShelfEdges {
  const max = scrollWidth - clientWidth;
  const overflow = max > TOLERANCE;
  return {
    overflow,
    back: overflow && scrollLeft > TOLERANCE,
    forward: overflow && scrollLeft < max - TOLERANCE
  };
}
