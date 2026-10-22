/**
 * Tests for where a cascading submenu opens: beside its item when the viewport
 * has room, on the other side when it does not, and moved up when its bottom
 * would leave the screen.
 */
import { describe, expect, it } from 'vitest';

import { submenuPlacement } from './menu-placement';

/** A box of the given size at the given top-left corner. */
function box(left: number, top: number, width: number, height: number) {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

describe('submenu placement', () => {
  it('opens to the right when the viewport has room', () => {
    const placement = submenuPlacement(
      box(100, 100, 270, 40),
      { width: 270, height: 200 },
      { width: 1440, height: 900 }
    );

    expect(placement.side).toBe('end');
    expect(placement.offset).toBe(0);
    expect(placement.maxHeight).toBeNull();
  });

  it('flips to the left when the right edge would cut the submenu off', () => {
    const placement = submenuPlacement(
      box(1100, 100, 270, 40),
      { width: 270, height: 200 },
      { width: 1440, height: 900 }
    );

    expect(placement.side).toBe('start');
  });

  it('stays right when neither side fits', () => {
    const placement = submenuPlacement(
      box(100, 100, 270, 40),
      { width: 270, height: 200 },
      { width: 500, height: 900 }
    );

    expect(placement.side).toBe('end');
  });

  it('moves up when its bottom would leave the viewport', () => {
    const placement = submenuPlacement(
      box(100, 800, 270, 40),
      { width: 270, height: 400 },
      { width: 1440, height: 900 }
    );

    expect(placement.offset).toBe(-308);
    expect(placement.maxHeight).toBeNull();
  });

  it('reports a height to scroll within when the submenu is taller than the viewport', () => {
    const placement = submenuPlacement(
      box(100, 100, 270, 40),
      { width: 270, height: 1000 },
      { width: 1440, height: 900 }
    );

    expect(placement.offset).toBe(-92);
    expect(placement.maxHeight).toBe(884);
  });
});
