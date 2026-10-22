/**
 * Where a cascading submenu sits relative to its menu item.
 *
 * A submenu opens beside the item that owns it, to the right. That is right
 * for a menu anywhere but the viewport edge: a menu anchored to the right of
 * the window, as the song rows' "More Actions" is, would push the whole
 * submenu off screen. The placement below flips it to the left when the right
 * side does not fit, slides it up when the bottom does not, and reports the
 * height it must shrink to when the viewport cannot hold it at all.
 */

/** The edges of a box, in viewport coordinates; a `DOMRect` satisfies it. */
export interface Box {
  /** The top edge. */
  readonly top: number;
  /** The right edge. */
  readonly right: number;
  /** The bottom edge. */
  readonly bottom: number;
  /** The left edge. */
  readonly left: number;
  /** The width. */
  readonly width: number;
  /** The height. */
  readonly height: number;
}

/** Where a submenu opens and how far it moves to stay in view. */
export interface SubmenuPlacement {
  /** The side of the item the submenu opens on. */
  readonly side: 'end' | 'start';
  /** The vertical offset from the item's top, in pixels; negative moves up. */
  readonly offset: number;
  /** The greatest height that keeps the submenu inside the viewport, or `null`. */
  readonly maxHeight: number | null;
}

/** The space between an item and its submenu (the package's 6 px gap). */
export const SUBMENU_GAP = 6;

/** The smallest space the submenu keeps from the viewport edge. */
export const SUBMENU_MARGIN = 8;

/**
 * Places a submenu beside its item, inside the viewport.
 *
 * @param item The item's box, in viewport coordinates.
 * @param submenu The submenu's size.
 * @param viewport The viewport's size.
 * @returns The side to open on, the vertical offset and, when the viewport is
 *   shorter than the submenu, the height it must scroll within.
 */
export function submenuPlacement(
  item: Box,
  submenu: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number }
): SubmenuPlacement {
  const fitsRight = item.right + SUBMENU_GAP + submenu.width <= viewport.width - SUBMENU_MARGIN;
  const fitsLeft = item.left - SUBMENU_GAP - submenu.width >= SUBMENU_MARGIN;
  const side = fitsRight || !fitsLeft ? 'end' : 'start';

  // Keep the top edge in view first, then move the submenu up if its bottom
  // edge would fall past the viewport.
  const minOffset = SUBMENU_MARGIN - item.top;
  const bottomOffset = viewport.height - SUBMENU_MARGIN - item.top - submenu.height;
  const offset = Math.max(Math.min(0, bottomOffset), minOffset);

  const overflows = item.top + offset + submenu.height > viewport.height - SUBMENU_MARGIN;
  const maxHeight = overflows ? viewport.height - SUBMENU_MARGIN * 2 : null;

  return { side, offset, maxHeight };
}
