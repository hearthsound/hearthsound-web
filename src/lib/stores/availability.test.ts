/**
 * Tests for the availability store: the state it reports, the responses it
 * remembers and the events it follows.
 */
import { describe, expect, it } from 'vitest';

import { availabilityEvent, FakeEventStream } from '#lib/testing/event-stream';
import { AvailabilityStore } from './availability.svelte';

describe('availability store', () => {
  it('reports nothing about an id it never heard of', () => {
    const store = new AvailabilityStore();

    expect(store.get('tr_1')).toBeNull();
  });

  it('applies an availability event to its track', () => {
    const store = new AvailabilityStore();

    store.apply(availabilityEvent('tr_1', 'acquiring'));
    store.apply(availabilityEvent('tr_1', 'local'));

    expect(store.get('tr_1')).toBe('local');
    expect(store.get('tr_2')).toBeNull();
  });

  it('remembers the availability of a browse response, and skips entities without one', () => {
    const store = new AvailabilityStore();

    store.remember([
      { id: 'tr_1', hearthsound: { availability: 'remote' } },
      { id: 'tr_2' },
      { id: 'tr_3', hearthsound: { availability: 'cached' } }
    ]);

    expect(store.get('tr_1')).toBe('remote');
    expect(store.get('tr_2')).toBeNull();
    expect(store.get('tr_3')).toBe('cached');
  });

  it('follows a stream and stops following when the subscription ends', () => {
    const store = new AvailabilityStore();
    const stream = new FakeEventStream();

    const stop = store.follow(stream);
    stream.emit(availabilityEvent('tr_1', 'local'));
    expect(store.get('tr_1')).toBe('local');

    stop();
    stream.emit(availabilityEvent('tr_2', 'remote'));
    expect(store.get('tr_2')).toBeNull();
  });
});
