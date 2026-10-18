/**
 * Tests for the client's fixed strings: availability badges, acquisition
 * progress, failure reasons and queue prefetch labels.
 */
import { describe, expect, it } from 'vitest';

import { availabilityLabel, failureLabel, prefetchLabel, progressLabel } from './labels';

describe('availability labels', () => {
  it('names every availability state', () => {
    expect(availabilityLabel('local')).toBe('On server');
    expect(availabilityLabel('cached')).toBe('Cached');
    expect(availabilityLabel('acquiring')).toBe('Downloading');
    expect(availabilityLabel('remote')).toBe('Not on server');
    expect(availabilityLabel('unavailable')).toBe('Unavailable');
  });
});

describe('progress labels', () => {
  it('reports the search before the download starts', () => {
    for (const state of ['queued', 'resolving', 'searching'] as const) {
      expect(progressLabel({ state })).toBe('Searching sources');
    }
  });

  it('rounds the download percentage down, and names the download without one', () => {
    expect(progressLabel({ state: 'downloading', percent: 0 })).toBe('Downloading 0%');
    expect(progressLabel({ state: 'downloading', percent: 47 })).toBe('Downloading 47%');
    expect(progressLabel({ state: 'downloading', percent: 99.7 })).toBe('Downloading 99%');
    expect(progressLabel({ state: 'downloading' })).toBe('Downloading');
  });

  it('reports an imported file as a finished download and a playable one as ready', () => {
    expect(progressLabel({ state: 'verifying' })).toBe('Downloading 100%');
    expect(progressLabel({ state: 'importing' })).toBe('Downloading 100%');
    expect(progressLabel({ availability: 'local' })).toBe('Ready');
    expect(progressLabel({ availability: 'cached' })).toBe('Ready');
  });

  it('explains a failure with its reason', () => {
    expect(progressLabel({ state: 'failed', failureReason: 'no-candidates' })).toBe(
      'Could not get this song: no source has it.'
    );
    expect(progressLabel({ state: 'failed', failureReason: 'quota-exceeded' })).toBe(
      'Could not get this song: your daily quota is used up.'
    );
    expect(progressLabel({ state: 'failed' })).toBe('Could not get this song.');
  });

  it('reports a cancellation without calling it a failure', () => {
    expect(progressLabel({ state: 'cancelled' })).toBe('Cancelled');
  });

  it('falls back to the availability of an item nothing is acquiring', () => {
    expect(progressLabel({ availability: 'remote' })).toBe('Not on server');
    expect(progressLabel({ availability: 'acquiring' })).toBe('Downloading');
    expect(progressLabel({})).toBe('');
  });
});

describe('failure labels', () => {
  it('names every failure reason', () => {
    expect(failureLabel('no-candidates')).toBe('Could not get this song: no source has it.');
    expect(failureLabel('no-acceptable-quality')).toBe(
      'Could not get this song: no source meets the quality profile.'
    );
    expect(failureLabel('all-candidates-failed')).toBe(
      'Could not get this song: every source failed.'
    );
    expect(failureLabel('verification-failed')).toBe(
      'Could not get this song: the download did not match.'
    );
    expect(failureLabel('backend-unavailable')).toBe(
      'Could not get this song: the download service is unreachable.'
    );
    expect(failureLabel('quota-exceeded')).toBe(
      'Could not get this song: your daily quota is used up.'
    );
    expect(failureLabel('permission-denied')).toBe(
      'Could not get this song: you may not acquire songs.'
    );
    expect(failureLabel('timeout')).toBe('Could not get this song: it took too long.');
    expect(failureLabel('cancelled')).toBe('Could not get this song: it was cancelled.');
    expect(failureLabel(null)).toBe('Could not get this song.');
  });
});

describe('prefetch labels', () => {
  it('labels a playable item ready', () => {
    expect(prefetchLabel({ availability: 'local' })).toBe('Ready');
    expect(prefetchLabel({ availability: 'cached' })).toBe('Ready');
  });

  it('labels an item nothing can acquire unavailable', () => {
    expect(prefetchLabel({ availability: 'unavailable' })).toBe('Unavailable');
  });

  it('reports the running prefetch with its percentage', () => {
    expect(prefetchLabel({ availability: 'acquiring', state: 'downloading', percent: 40 })).toBe(
      'Prefetching 40%'
    );
    expect(prefetchLabel({ availability: 'acquiring', state: 'downloading' })).toBe('Prefetching');
    expect(prefetchLabel({ state: 'searching' })).toBe('Prefetching');
  });

  it('distinguishes a queued prefetch from one the scheduler never started', () => {
    expect(prefetchLabel({ availability: 'remote', prefetch: 'started' })).toBe('Prefetch queued');
    expect(prefetchLabel({ availability: 'remote', prefetch: 'dropped' })).toBe('Not prefetched');
    expect(prefetchLabel({ availability: 'remote' })).toBe('Not prefetched');
    expect(prefetchLabel({})).toBe('Not prefetched');
  });

  it("falls back to the scheduler's answer once the acquisition ended", () => {
    expect(prefetchLabel({ state: 'failed', availability: 'remote', prefetch: 'started' })).toBe(
      'Prefetch queued'
    );
    expect(prefetchLabel({ state: 'completed', availability: 'remote', prefetch: 'dropped' })).toBe(
      'Not prefetched'
    );
  });
});
