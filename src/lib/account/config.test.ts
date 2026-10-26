/**
 * Tests for the configuration comparison the service form's Save depends on.
 */
import { describe, expect, it } from 'vitest';

import { configsEqual } from './config';

describe('configsEqual', () => {
  it('ignores the order of the keys', () => {
    expect(configsEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('compares nested objects and arrays by value', () => {
    expect(configsEqual({ a: { b: [1, { c: 'x' }] } }, { a: { b: [1, { c: 'x' }] } })).toBe(true);
    expect(configsEqual({ a: { b: [1, 2] } }, { a: { b: [1, 3] } })).toBe(false);
    expect(configsEqual([1, 2], [1, 2])).toBe(true);
    expect(configsEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('treats an absent key and an undefined one as the same', () => {
    expect(configsEqual({ token: undefined }, {})).toBe(true);
    expect(configsEqual({}, { token: '[sealed]' })).toBe(false);
  });

  it('compares the placeholder as the value it is', () => {
    expect(configsEqual({ token: '[sealed]' }, { token: '[sealed]' })).toBe(true);
    expect(configsEqual({ token: '[sealed]' }, { token: 'other' })).toBe(false);
  });

  it('refuses a scalar against an object', () => {
    expect(configsEqual('x', { a: 'x' })).toBe(false);
    expect(configsEqual(null, {})).toBe(false);
  });
});
