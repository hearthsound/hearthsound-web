/**
 * Tests for the prefetch state: what the queue page labels after a sequence of
 * server events.
 */
import { describe, expect, it } from 'vitest';

import { acquisitionEvent, availabilityEvent, prefetchEvent } from '#lib/testing/event-stream';
import { prefetchLabel } from '#lib/labels';
import { PrefetchTracker, UNKNOWN_PREFETCH } from './prefetch.svelte';

/** The client instance name the tests run under. */
const CLIENT = 'hearthsound-web-00000000';

/**
 * Names the label the queue page would render for a track.
 *
 * @param tracker The tracker to read.
 * @param trackId The track to read.
 * @returns The label.
 */
function labelOf(tracker: PrefetchTracker, trackId: string): string {
  const state = tracker.stateFor(trackId);
  return prefetchLabel({
    availability: state.availability,
    state: state.state,
    percent: state.percent,
    prefetch: state.prefetch
  });
}

describe('prefetch tracker', () => {
  it('labels a track nothing was heard about as not prefetched', () => {
    const tracker = new PrefetchTracker(CLIENT);

    expect(tracker.stateFor('tr_1')).toEqual(UNKNOWN_PREFETCH);
    expect(labelOf(tracker, 'tr_1')).toBe('Not prefetched');
  });

  it('follows one track from the declaration to the finished download', () => {
    const tracker = new PrefetchTracker(CLIENT);

    tracker.apply(prefetchEvent('tr_1', 'started', CLIENT));
    expect(labelOf(tracker, 'tr_1')).toBe('Prefetch queued');

    tracker.adopt([{ id: 'tr_1', state: 'acquiring', inLibrary: false, acquisitionId: 'ac_1' }]);
    expect(labelOf(tracker, 'tr_1')).toBe('Prefetch queued');

    tracker.apply(
      acquisitionEvent({
        acquisitionId: 'ac_1',
        targetId: 'tr_1',
        state: 'searching',
        priority: 'queue'
      })
    );
    expect(labelOf(tracker, 'tr_1')).toBe('Prefetching');

    tracker.apply(
      acquisitionEvent({
        acquisitionId: 'ac_1',
        targetId: 'tr_1',
        state: 'downloading',
        priority: 'queue',
        percent: 40
      })
    );
    expect(labelOf(tracker, 'tr_1')).toBe('Prefetching 40%');

    tracker.apply(availabilityEvent('tr_1', 'local'));

    expect(labelOf(tracker, 'tr_1')).toBe('Ready');
    expect(tracker.stateFor('tr_1')).toMatchObject({
      availability: 'local',
      acquisitionId: null,
      state: null,
      percent: null
    });
  });

  it('reports a dropped prefetch as not prefetched', () => {
    const tracker = new PrefetchTracker(CLIENT);
    tracker.apply(prefetchEvent('tr_1', 'started', CLIENT));

    tracker.apply(prefetchEvent('tr_1', 'dropped', CLIENT));

    expect(labelOf(tracker, 'tr_1')).toBe('Not prefetched');
  });

  it('ignores the declarations of another client', () => {
    const tracker = new PrefetchTracker(CLIENT);

    tracker.apply(prefetchEvent('tr_1', 'started', 'hearthsound-web-ffffffff'));

    expect(tracker.stateFor('tr_1')).toEqual(UNKNOWN_PREFETCH);
  });

  it('ignores the acquisitions of tracks it does not track', () => {
    const tracker = new PrefetchTracker(CLIENT);

    tracker.apply(
      acquisitionEvent({
        acquisitionId: 'ac_9',
        targetId: 'tr_9',
        state: 'downloading',
        priority: 'play',
        percent: 10
      })
    );

    expect(tracker.stateFor('tr_9')).toEqual(UNKNOWN_PREFETCH);
  });

  it('clears the acquisition when an availability read no longer names one', () => {
    const tracker = new PrefetchTracker(CLIENT);
    tracker.adopt([{ id: 'tr_1', state: 'acquiring', inLibrary: false, acquisitionId: 'ac_1' }]);
    tracker.apply(
      acquisitionEvent({
        acquisitionId: 'ac_1',
        targetId: 'tr_1',
        state: 'downloading',
        priority: 'queue',
        percent: 10
      })
    );

    tracker.adopt([{ id: 'tr_1', state: 'unavailable', inLibrary: false }]);

    expect(tracker.stateFor('tr_1')).toMatchObject({
      availability: 'unavailable',
      acquisitionId: null,
      state: null,
      percent: null
    });
    expect(labelOf(tracker, 'tr_1')).toBe('Unavailable');
  });
});
