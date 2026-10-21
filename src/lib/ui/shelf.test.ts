/**
 * Tests for the shelf scroll buttons: when they show and which ends are
 * already reached.
 */
import { describe, expect, it } from 'vitest';

import { shelfEdges } from './shelf';

describe('shelf edges', () => {
  it('hides both buttons while the row fits the window', () => {
    expect(shelfEdges(0, 800, 800)).toEqual({ overflow: false, back: false, forward: false });
  });

  it('starts with the left button disabled and the right one usable', () => {
    expect(shelfEdges(0, 1600, 800)).toEqual({ overflow: true, back: false, forward: true });
  });

  it('enables both buttons in the middle of the row', () => {
    expect(shelfEdges(400, 1600, 800)).toEqual({ overflow: true, back: true, forward: true });
  });

  it('disables the right button at the far end', () => {
    expect(shelfEdges(800, 1600, 800)).toEqual({ overflow: true, back: true, forward: false });
  });

  it('treats sub-pixel offsets as the very end', () => {
    expect(shelfEdges(799.6, 1600, 800)).toEqual({ overflow: true, back: true, forward: false });
    expect(shelfEdges(0.4, 1600, 800)).toEqual({ overflow: true, back: false, forward: true });
  });

  it('hides both buttons for a row that overflows by a rounding error only', () => {
    expect(shelfEdges(0, 800.5, 800)).toEqual({ overflow: false, back: false, forward: false });
  });
});
