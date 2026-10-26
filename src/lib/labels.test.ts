/**
 * Tests for the client's fixed strings: availability badges, acquisition
 * progress, failure reasons and queue prefetch labels.
 */
import { describe, expect, it } from 'vitest';

import {
  availabilityLabel,
  failureLabel,
  failureSentence,
  prefetchLabel,
  progressLabel,
  STREAM_FAILED_SENTENCE
} from './labels';

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

  it('words a parked acquisition as waiting, with the cause it names', () => {
    expect(progressLabel({ state: 'queued', awaitingSource: true, parkReason: 'no-source' })).toBe(
      'Waiting for a download source'
    );
    expect(
      progressLabel({ state: 'queued', awaitingSource: true, parkReason: 'source-unavailable' })
    ).toBe('Waiting for the download source to answer');
    expect(progressLabel({ state: 'queued', awaitingSource: true })).toBe(
      'Waiting for a download source'
    );
    // A running acquisition is unaffected by the member.
    expect(progressLabel({ state: 'downloading', percent: 10, awaitingSource: false })).toBe(
      'Downloading 10%'
    );
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

describe('failure sentences', () => {
  it('writes a reason as the sentence a tooltip shows', () => {
    expect(failureSentence('no-candidates')).toBe('No source has it.');
    expect(failureSentence('no-acceptable-quality')).toBe('No source meets the quality profile.');
    expect(failureSentence('quota-exceeded')).toBe('Your daily quota is used up.');
    expect(failureSentence('permission-denied')).toBe('You may not acquire songs.');
    expect(failureSentence(null)).toBe('Could not get this song.');
  });

  it('names a failed play when no reason explains it', () => {
    expect(failureSentence(null, { playFailed: true })).toBe(STREAM_FAILED_SENTENCE);
    expect(STREAM_FAILED_SENTENCE).toBe('Could not play this song.');
    expect(failureSentence('quota-exceeded', { playFailed: true })).toBe(
      'Your daily quota is used up.'
    );
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
