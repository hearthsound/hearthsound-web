/**
 * Tests for the state a page opened on a catalog entity decides from: when it
 * is still waiting for the enrichment job and when it may say it has nothing.
 */
import { describe, expect, it } from 'vitest';

import { awaitingEnrichment, ENRICHMENT_WINDOW_MS, showsEmptyLine } from './enrichment';
import type { EmptyLineState } from './enrichment';

/** A page holding nothing yet that has not waited, unless a test says otherwise. */
function state(change: Partial<EmptyLineState> = {}): EmptyLineState {
  return {
    settled: false,
    hasExtras: false,
    waited: false,
    loading: false,
    failed: false,
    ...change
  };
}

describe('a page whose enrichment may still arrive', () => {
  it('waits for the enrichment job', () => {
    expect(awaitingEnrichment(state())).toBe(true);
  });

  it('stops waiting once the job announced its entity', () => {
    expect(awaitingEnrichment(state({ settled: true }))).toBe(false);
  });

  it('stops waiting when the page already holds something', () => {
    expect(awaitingEnrichment(state({ hasExtras: true }))).toBe(false);
  });

  it('stops waiting when the window has passed', () => {
    expect(awaitingEnrichment(state({ waited: true }))).toBe(false);
  });
});

describe('the empty line', () => {
  it('is left out while the page is still reading', () => {
    expect(showsEmptyLine(state({ loading: true }))).toBe(false);
  });

  it('is left out after a failed read, which has its own line', () => {
    expect(showsEmptyLine(state({ failed: true }))).toBe(false);
  });

  it('is left out while the enrichment job may still answer', () => {
    expect(showsEmptyLine(state())).toBe(false);
  });

  it('appears once the job that found nothing settled', () => {
    expect(showsEmptyLine(state({ settled: true }))).toBe(true);
  });

  it('appears after the window, so a job that never answers cannot shimmer forever', () => {
    expect(showsEmptyLine(state({ waited: true }))).toBe(true);
  });

  it('never appears while the page holds something', () => {
    expect(showsEmptyLine(state({ hasExtras: true }))).toBe(false);
  });
});

describe('the window', () => {
  it('is long enough for the job to answer a first visit', () => {
    expect(ENRICHMENT_WINDOW_MS).toBeGreaterThanOrEqual(10_000);
  });
});
