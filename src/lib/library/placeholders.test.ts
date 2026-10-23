/**
 * Tests for the placeholder counts: a first page and a later batch both draw
 * exactly what the list is about to bring.
 */
import { describe, expect, it } from 'vitest';

import { firstPagePlaceholders, nextPagePlaceholders } from './placeholders';

describe('first-page placeholders', () => {
  it('draws one page when the total is unknown', () => {
    expect(firstPagePlaceholders(null, 60)).toBe(60);
  });

  it('draws the total when it is smaller than a page', () => {
    expect(firstPagePlaceholders(7, 60)).toBe(7);
    expect(firstPagePlaceholders(0, 60)).toBe(0);
  });

  it('draws one page when the total is larger than a page', () => {
    expect(firstPagePlaceholders(585, 60)).toBe(60);
  });
});

describe('next-page placeholders', () => {
  it('draws one page when the total is unknown', () => {
    expect(nextPagePlaceholders(null, 0, 60)).toBe(60);
  });

  it('draws the items the next page brings', () => {
    expect(nextPagePlaceholders(585, 60, 60)).toBe(60);
    expect(nextPagePlaceholders(585, 540, 60)).toBe(45);
  });

  it('draws nothing when the list is complete', () => {
    expect(nextPagePlaceholders(585, 585, 60)).toBe(0);
    expect(nextPagePlaceholders(585, 700, 60)).toBe(0);
    expect(nextPagePlaceholders(0, 0, 60)).toBe(0);
  });
});
