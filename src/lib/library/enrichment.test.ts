/**
 * Tests for the state a page opened on a catalog entity decides from: when it
 * is still waiting for the enrichment job and when it may say it has nothing.
 */
import { describe, expect, it } from 'vitest';

import { awaitingEnrichment, showsEmptyLine } from './enrichment';
import type { EmptyLineState } from './enrichment';

/** A page holding nothing yet, unless a test says otherwise. */
function state(change: Partial<EmptyLineState> = {}): EmptyLineState {
  return {
    origin: 'catalog',
    settled: false,
    hasExtras: false,
    loading: false,
    failed: false,
    ...change
  };
}

describe('a cold catalog page', () => {
  it('waits for the enrichment job', () => {
    expect(awaitingEnrichment(state())).toBe(true);
  });

  it('stops waiting once the job announced its entity', () => {
    expect(awaitingEnrichment(state({ settled: true }))).toBe(false);
  });

  it('stops waiting when the page already holds something', () => {
    expect(awaitingEnrichment(state({ hasExtras: true }))).toBe(false);
  });

  it('never waits for an entity the library or the server holds', () => {
    expect(awaitingEnrichment(state({ origin: 'library' }))).toBe(false);
    expect(awaitingEnrichment(state({ origin: 'server' }))).toBe(false);
    expect(awaitingEnrichment(state({ origin: undefined }))).toBe(false);
  });
});

describe('the empty line', () => {
  it('is left out while the page is still reading', () => {
    expect(showsEmptyLine(state({ loading: true }))).toBe(false);
  });

  it('is left out after a failed read, which has its own line', () => {
    expect(showsEmptyLine(state({ failed: true }))).toBe(false);
  });

  it('is left out while a cold catalog page waits for its enrichment', () => {
    expect(showsEmptyLine(state())).toBe(false);
  });

  it('appears for a library entity with nothing in it', () => {
    expect(showsEmptyLine(state({ origin: 'library' }))).toBe(true);
    expect(showsEmptyLine(state({ origin: 'server' }))).toBe(true);
  });

  it('appears for a catalog entity once the job that found nothing settled', () => {
    expect(showsEmptyLine(state({ settled: true }))).toBe(true);
  });

  it('never appears while the page holds something', () => {
    expect(showsEmptyLine(state({ origin: 'library', hasExtras: true }))).toBe(false);
  });
});
