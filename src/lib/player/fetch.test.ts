/**
 * Tests for the fetch-state mapping both player surfaces draw: the pill and
 * disc of a track being fetched, and the pill of an upcoming queue row.
 */
import { describe, expect, it } from 'vitest';

import { fetchFailed, fetchView, playDisc, prefetchPill, WAITING_FOR_SOURCE_LABEL } from './fetch';
import type { FetchView } from './fetch';

describe('fetch failed', () => {
  it('is every reason but a cancellation', () => {
    expect(fetchFailed('no-candidates')).toBe(true);
    expect(fetchFailed('timeout')).toBe(true);
    expect(fetchFailed('cancelled')).toBe(false);
    expect(fetchFailed(null)).toBe(false);
    expect(fetchFailed(undefined)).toBe(false);
  });
});

describe('fetch view', () => {
  it('reports a search', () => {
    const view = fetchView({ state: 'searching', percent: null }, null);

    expect(view.fetching).toBe(true);
    expect(view.failed).toBe(false);
    expect(view.pill).toEqual({
      tone: 'accent',
      glyph: 'adwaita-search',
      label: 'Searching sources'
    });
  });

  it('reports the download with its percentage', () => {
    const view = fetchView({ state: 'downloading', percent: 42.7 }, null);

    expect(view.fetching).toBe(true);
    expect(view.pill).toEqual({
      tone: 'accent',
      glyph: 'adwaita-acquire',
      label: 'Downloading 42%'
    });
  });

  it('reports an import as a finished download', () => {
    const view = fetchView({ state: 'importing', percent: null }, null);

    expect(view.fetching).toBe(true);
    expect(view.pill?.label).toBe('Downloading 100%');
  });

  it('reports a failure whatever the step was', () => {
    const view = fetchView({ state: 'downloading', percent: 80 }, 'all-candidates-failed');

    expect(view.failed).toBe(true);
    expect(view.fetching).toBe(false);
    expect(view.pill).toEqual({ tone: 'error', glyph: 'adwaita-error', label: 'Failed' });
  });

  it('keeps a cancellation quiet', () => {
    const view = fetchView({ state: 'downloading', percent: 15 }, 'cancelled');

    expect(view.failed).toBe(false);
    expect(view.fetching).toBe(false);
    expect(view.pill).toBeNull();
  });

  it('does not call a cancelled row a failed play', () => {
    const view = fetchView({ state: 'searching', percent: null }, 'cancelled');

    expect(fetchFailed('cancelled')).toBe(false);
    expect(view.failed).toBe(false);
    expect(playDisc(view, false)).toBe('play');
  });

  it('draws the failed pill from a terminal state alone', () => {
    const view = fetchView({ state: 'failed' }, null);

    expect(view.failed).toBe(true);
    expect(view.fetching).toBe(false);
    expect(view.pill).toEqual({ tone: 'error', glyph: 'adwaita-error', label: 'Failed' });
  });

  it('names the missing download source on a queued request', () => {
    const view = fetchView({ state: 'queued', percent: null }, null, false, false);

    expect(view.failed).toBe(false);
    expect(view.fetching).toBe(true);
    expect(view.pill).toEqual({
      tone: 'accent',
      glyph: 'adwaita-acquire',
      label: WAITING_FOR_SOURCE_LABEL
    });
    expect(WAITING_FOR_SOURCE_LABEL).toBe('Waiting for a download source');
  });

  it('searches while a queued request has a source to wait for', () => {
    const view = fetchView({ state: 'queued', percent: null }, null, false, true);

    expect(view.pill?.label).toBe('Searching sources');
  });

  it('draws no pill while nothing is fetched', () => {
    expect(fetchView(null, null)).toEqual({ failed: false, fetching: false, pill: null });
  });
});

describe('play disc', () => {
  const idle: FetchView = { failed: false, fetching: false, pill: null };

  it('offers a retry after a failure', () => {
    expect(playDisc({ ...idle, failed: true }, false)).toBe('retry');
  });

  it('offers a retry when the play itself failed', () => {
    expect(playDisc(fetchView(null, 'no-candidates'), false)).toBe('retry');
    expect(playDisc(fetchView(null, null, true), false)).toBe('retry');
  });

  it('turns while a fetch runs', () => {
    expect(playDisc({ ...idle, fetching: true }, true)).toBe('fetching');
  });

  it('plays or pauses when nothing is fetched', () => {
    expect(playDisc(idle, false)).toBe('play');
    expect(playDisc(idle, true)).toBe('pause');
  });
});

describe('queue row pill', () => {
  it('marks a ready item', () => {
    expect(prefetchPill({ availability: 'local' })).toEqual({
      tone: 'success',
      glyph: 'adwaita-check',
      label: 'Ready'
    });
  });

  it('marks an item the scheduler runs', () => {
    expect(prefetchPill({ availability: 'remote', state: 'downloading', percent: 12 })).toEqual({
      tone: 'accent',
      glyph: 'adwaita-acquire',
      label: 'Prefetching 12%'
    });
  });

  it('marks an item the scheduler queued', () => {
    expect(prefetchPill({ availability: 'remote', prefetch: 'started' })).toEqual({
      tone: 'neutral',
      glyph: 'adwaita-queue',
      label: 'Prefetch queued'
    });
  });

  it('marks an unavailable item and one nothing is doing', () => {
    expect(prefetchPill({ availability: 'unavailable' }).glyph).toBe('adwaita-remove');
    expect(prefetchPill({ availability: 'remote' })).toEqual({
      tone: 'neutral',
      glyph: 'adwaita-remove',
      label: 'Not prefetched'
    });
  });
});
