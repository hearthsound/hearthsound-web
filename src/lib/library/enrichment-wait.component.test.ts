/**
 * Tests for the bounded wait a page gives the enrichment job: it flips once the
 * window has passed, and a restart begins a new window.
 */
import { mount, unmount, type Component } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENRICHMENT_WINDOW_MS } from './enrichment';
import { createEnrichmentWait } from './enrichment-wait.svelte';

/** The wait the mounted page created, read back for the assertions. */
let wait: ReturnType<typeof createEnrichmentWait> | undefined;

/** A page that owns one wait and draws nothing, so the tests can mount it. */
const Page: Component = () => {
  wait = createEnrichmentWait();
  return {};
};

/** The mounted page, once a test has one. */
let mounted: Record<string, unknown> | undefined;

/** Mounts the page, whose initialisation creates the wait. */
function open(): void {
  mounted = mount(Page, { target: document.body });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  if (mounted !== undefined) {
    unmount(mounted);
    mounted = undefined;
  }
  wait = undefined;
  vi.useRealTimers();
});

describe('the enrichment wait', () => {
  it('does not report the window as passed before the page reads', () => {
    open();

    expect(wait?.waited).toBe(false);
  });

  it('reports the window as passed only once it elapses', () => {
    open();
    wait?.restart();

    vi.advanceTimersByTime(ENRICHMENT_WINDOW_MS - 1);
    expect(wait?.waited).toBe(false);

    vi.advanceTimersByTime(1);
    expect(wait?.waited).toBe(true);
  });

  it('begins a new window when the page reads again', () => {
    open();
    wait?.restart();
    vi.advanceTimersByTime(ENRICHMENT_WINDOW_MS);
    expect(wait?.waited).toBe(true);

    wait?.restart();
    expect(wait?.waited).toBe(false);

    vi.advanceTimersByTime(ENRICHMENT_WINDOW_MS);
    expect(wait?.waited).toBe(true);
  });
});
