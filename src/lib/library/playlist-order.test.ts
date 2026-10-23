/**
 * Tests for turning a reordered playlist back into the positions the order
 * endpoint takes: a move sends a permutation, an untouched list sends nothing.
 */
import { describe, expect, it } from 'vitest';

import { changedOrder } from './playlist-order';

describe('playlist order', () => {
  it('answers the new positions when the order changed', () => {
    expect(changedOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual([2, 0, 1]);
    expect(changedOrder(['a', 'b', 'c'], ['b', 'a', 'c'])).toEqual([1, 0, 2]);
  });

  it('answers nothing when the order did not change', () => {
    expect(changedOrder(['a', 'b', 'c'], ['a', 'b', 'c'])).toBeNull();
  });

  it('answers nothing for a list that does not name the same entries', () => {
    expect(changedOrder(['a', 'b'], ['a', 'c'])).toBeNull();
    expect(changedOrder(['a', 'b'], ['a'])).toBeNull();
    expect(changedOrder(['a'], ['a', 'a'])).toBeNull();
  });

  it('handles an empty playlist', () => {
    expect(changedOrder([], [])).toBeNull();
  });
});
