/**
 * Tests for where a popover panel opens: below its trigger when the viewport has
 * room, above it when it does not, inside the viewport at both edges, with the
 * height it must scroll within and the width a drop-down's list keeps.
 */
import { describe, expect, it } from 'vitest';

import { POPOVER_GAP, POPOVER_MARGIN, popoverPlacement } from './popover-placement';
import type { Box } from './menu-placement';

/**
 * Builds a box of the given size at the given top-left corner.
 *
 * @param left The distance from the viewport's left edge.
 * @param top The distance from the viewport's top edge.
 * @param width The box's width.
 * @param height The box's height.
 * @returns The box.
 */
function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

describe('popover placement', () => {
  it('opens below the trigger when the viewport has room', () => {
    const where = popoverPlacement(
      box(100, 100, 200, 36),
      { width: 220, height: 200 },
      { width: 1440, height: 900 }
    );

    expect(where.below).toBe(true);
    expect(where.top).toBe(136 + POPOVER_GAP);
    expect(where.left).toBe(100);
    expect(where.maxHeight).toBeNull();
    expect(where.width).toBeNull();
  });

  it('flips above the trigger when the viewport has no room below', () => {
    const where = popoverPlacement(
      box(100, 700, 200, 36),
      { width: 220, height: 300 },
      { width: 1440, height: 900 }
    );

    expect(where.below).toBe(false);
    expect(where.top).toBe(700 - POPOVER_GAP - 300);
    expect(where.maxHeight).toBeNull();
  });

  it('keeps the panel inside the viewport at the left edge', () => {
    const where = popoverPlacement(
      box(2, 100, 200, 36),
      { width: 220, height: 200 },
      { width: 1440, height: 900 }
    );

    expect(where.left).toBe(POPOVER_MARGIN);
  });

  it('keeps the panel inside the viewport at the right edge', () => {
    const where = popoverPlacement(
      box(1200, 100, 200, 36),
      { width: 300, height: 200 },
      { width: 1440, height: 900 }
    );

    expect(where.left).toBe(1440 - POPOVER_MARGIN - 300);
  });

  it('reports the height a panel taller than its side must scroll within', () => {
    const where = popoverPlacement(
      box(100, 100, 200, 36),
      { width: 220, height: 1000 },
      { width: 1440, height: 900 }
    );

    expect(where.below).toBe(true);
    expect(where.maxHeight).toBe(900 - POPOVER_MARGIN - 136 - POPOVER_GAP);
  });

  it('keeps the trigger width only for a panel that matches it', () => {
    const trigger = box(100, 100, 200, 36);
    const panel = { width: 260, height: 200 };
    const viewport = { width: 1440, height: 900 };

    expect(popoverPlacement(trigger, panel, viewport).width).toBeNull();
    expect(popoverPlacement(trigger, panel, viewport, { matchWidth: true }).width).toBe(200);
  });

  it('aligns the panel to the trigger edge the caller names', () => {
    const trigger = box(400, 100, 200, 36);
    const panel = { width: 100, height: 200 };
    const viewport = { width: 1440, height: 900 };

    expect(popoverPlacement(trigger, panel, viewport, { align: 'end' }).left).toBe(500);
  });
});
