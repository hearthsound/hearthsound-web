/**
 * Tests for the event store: the connection it opens, the frames it dispatches
 * and the resynchronisation it asks for.
 */
import { describe, expect, it } from 'vitest';

import { availabilityEvent, noticeEvent } from '#lib/testing/event-stream';
import { EventStore, EVENTS_PATH } from './events.svelte';
import type { EventSourceLike, ServerEvent } from './events.svelte';

/** A connection a test drives by hand. */
class FakeSource implements EventSourceLike {
  readonly url: string;

  closed = false;

  readonly #listeners = new Map<string, Set<(event: { data?: string }) => void>>();

  /**
   * Records the URL it was opened with.
   *
   * @param url The stream URL.
   */
  constructor(url: string) {
    this.url = url;
  }

  /**
   * Registers a listener for one stream event.
   *
   * @param type The event name.
   * @param listener The listener to call.
   */
  addEventListener(type: string, listener: (event: { data?: string }) => void): void {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  /** Closes the connection. */
  close(): void {
    this.closed = true;
  }

  /**
   * Delivers one frame.
   *
   * @param event The event to deliver.
   * @returns Nothing.
   */
  emit(event: ServerEvent): void {
    for (const listener of this.#listeners.get(event.type) ?? []) {
      listener({ data: JSON.stringify(event) });
    }
  }

  /**
   * Delivers one frame with a body that is not an event.
   *
   * @param data The frame body.
   * @returns Nothing.
   */
  emitRaw(data: string): void {
    for (const listener of this.#listeners.get('system.notice') ?? []) {
      listener({ data });
    }
  }
}

describe('event store', () => {
  it('opens one stream and dispatches frames to the handlers of their type', () => {
    const sources: FakeSource[] = [];
    const store = new EventStore({
      createSource: (url) => {
        const source = new FakeSource(url);
        sources.push(source);
        return source;
      }
    });
    const seen: string[] = [];
    store.on('track.availability', (event) => seen.push(event.data.trackId));
    store.on('system.notice', () => seen.push('notice'));

    store.open();
    store.open();

    expect(sources).toHaveLength(1);
    expect(sources[0].url).toBe(EVENTS_PATH);
    sources[0].emit(availabilityEvent('tr_1', 'local'));
    expect(seen).toEqual(['tr_1']);
  });

  it('gives a subscription only the events of its own type', () => {
    const sources: FakeSource[] = [];
    const store = new EventStore({
      createSource: (url) => {
        const source = new FakeSource(url);
        sources.push(source);
        return source;
      }
    });
    const seen: string[] = [];
    const stop = store.on('track.availability', (event) => seen.push(event.data.trackId));

    store.open();
    sources[0].emit(noticeEvent('server restarting'));
    sources[0].emit(availabilityEvent('tr_1', 'local'));
    stop();
    sources[0].emit(availabilityEvent('tr_2', 'remote'));

    expect(seen).toEqual(['tr_1']);
  });

  it('delivers an enrichment frame with the entity it names', () => {
    const sources: FakeSource[] = [];
    const store = new EventStore({
      createSource: (url) => {
        const source = new FakeSource(url);
        sources.push(source);
        return source;
      }
    });
    const seen: string[] = [];
    store.on('catalog.enriched', (event) => seen.push(`${event.data.kind}:${event.data.entityId}`));

    store.open();
    sources[0].emit({
      id: 1,
      type: 'catalog.enriched',
      at: 0,
      data: { entityId: 'x_deezer_ar_27', kind: 'artist' }
    });
    sources[0].emit(availabilityEvent('tr_1', 'local'));

    expect(seen).toEqual(['artist:x_deezer_ar_27']);
  });

  it('counts the notices that report lost events', () => {
    const sources: FakeSource[] = [];
    const store = new EventStore({
      createSource: (url) => {
        const source = new FakeSource(url);
        sources.push(source);
        return source;
      }
    });

    store.open();
    expect(store.resync).toBe(0);

    sources[0].emit(noticeEvent('events were lost', 'events-lost'));
    expect(store.resync).toBe(1);
    sources[0].emit(noticeEvent('server restarting'));
    expect(store.resync).toBe(1);
    sources[0].emit(noticeEvent('events were lost', 'events-lost'));
    expect(store.resync).toBe(2);
  });

  it('ignores a frame that is not an event and closes the connection', () => {
    const sources: FakeSource[] = [];
    const store = new EventStore({
      createSource: (url) => {
        const source = new FakeSource(url);
        sources.push(source);
        return source;
      }
    });
    const seen: string[] = [];
    store.on('system.notice', (event) => seen.push(event.data.message));

    store.open();
    sources[0].emitRaw('not json');
    expect(seen).toEqual([]);

    store.close();
    expect(sources[0].closed).toBe(true);
  });
});
