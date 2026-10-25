/**
 * Where a popover panel sits relative to the trigger that opened it.
 *
 * A list, a card and a page all hide their overflow, so a panel positioned
 * inside one is cut off at the box's edge, and focusing its first item makes the
 * page scroll to reach the clipped part. A panel is therefore `position: fixed`,
 * which no scrolling or clipping box contains, and this computes its viewport
 * coordinates: it opens below the trigger when that side has room and above it
 * otherwise, stays inside the viewport horizontally, and scrolls within itself
 * when the viewport cannot hold its height. The menu and the drop-down both
 * place their panels with it, so the two cannot drift apart.
 */
import type { Box } from './menu-placement';

/** The space a panel keeps from the viewport edge. */
export const POPOVER_MARGIN = 8;

/** The space between a trigger and its panel. */
export const POPOVER_GAP = 8;

/** Where a panel opens and how far it may grow. */
export interface PopoverPlacement {
  /** The distance of the panel's left edge from the viewport's left, in pixels. */
  readonly left: number;
  /** The distance of the panel's top edge from the viewport's top, in pixels. */
  readonly top: number;
  /** The greatest height that keeps the panel inside the viewport, or `null`. */
  readonly maxHeight: number | null;
  /** Whether the panel opened below its trigger rather than above it. */
  readonly below: boolean;
  /** The width the panel must keep, or `null` when it sizes itself. */
  readonly width: number | null;
}

/** How the panel relates to its trigger. */
export interface PopoverOptions {
  /** Whether the panel keeps the trigger's width, as a drop-down's list does. */
  readonly matchWidth?: boolean;
  /** Which edge of the trigger the panel is aligned to; `start` when absent. */
  readonly align?: 'start' | 'end';
}

/**
 * Places a popover panel against the viewport from its trigger's box.
 *
 * @param trigger The trigger's box, in viewport coordinates.
 * @param panel The panel's size.
 * @param viewport The viewport's size.
 * @param options Whether the panel keeps the trigger's width and which edge it
 *   aligns to.
 * @returns The panel's viewport coordinates, the height it must scroll within,
 *   the side it opened on and the width it must keep.
 */
export function popoverPlacement(
  trigger: Box,
  panel: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
  options: PopoverOptions = {}
): PopoverPlacement {
  const roomBelow = viewport.height - POPOVER_MARGIN - trigger.bottom - POPOVER_GAP;
  const roomAbove = trigger.top - POPOVER_MARGIN - POPOVER_GAP;
  const below = roomBelow >= panel.height || roomBelow >= roomAbove;
  const available = Math.max(below ? roomBelow : roomAbove, 0);
  const shown = Math.min(panel.height, available);

  const wanted = (options.align ?? 'start') === 'end' ? trigger.right - panel.width : trigger.left;
  const left = Math.min(
    Math.max(wanted, POPOVER_MARGIN),
    Math.max(viewport.width - POPOVER_MARGIN - panel.width, POPOVER_MARGIN)
  );
  const top = below ? trigger.bottom + POPOVER_GAP : trigger.top - POPOVER_GAP - shown;

  return {
    left,
    top,
    maxHeight: panel.height > available ? Math.round(available) : null,
    below,
    width: options.matchWidth === true ? trigger.width : null
  };
}
