/**
 * Test doubles for the server event stream.
 *
 * The stores and the player subscribe to something with `EventStore`'s shape;
 * a fake with the same shape lets a test hand them a scripted sequence of
 * events without a server, and the builders below spell the event envelopes out
 * so a test reads as the sequence the server would publish.
 */
import type { EventOf, EventStream, EventType, ServerEvent } from '#lib/stores/events.svelte';

/** An event stream a test drives by hand. */
export class FakeEventStream implements EventStream {
  readonly #handlers = new Map<EventType, Set<(event: ServerEvent) => void>>();

  /**
   * Registers a handler for one event type.
   *
   * @param type The event type to listen for.
   * @param handler The handler to call.
   * @returns A function that unregisters the handler.
   */
  on<T extends EventType>(type: T, handler: (event: EventOf<T>) => void): () => void {
    const handlers = this.#handlers.get(type) ?? new Set<(event: ServerEvent) => void>();
    const adapter = (event: ServerEvent): void => {
      if (event.type === type) {
        handler(event as EventOf<T>);
      }
    };
    handlers.add(adapter);
    this.#handlers.set(type, handlers);
    return () => {
      handlers.delete(adapter);
    };
  }

  /**
   * Delivers an event to the handlers of its type.
   *
   * @param event The event to deliver.
   * @returns Nothing.
   */
  emit<T extends EventType>(event: EventOf<T>): void {
    for (const handler of this.#handlers.get(event.type) ?? []) {
      handler(event);
    }
  }
}

/** A sequence number the builders share, so ids never repeat within a test. */
let sequence = 0;

/**
 * Builds a `track.availability` event.
 *
 * @param trackId The track's client id.
 * @param availability The new availability.
 * @returns The event.
 */
export function availabilityEvent(
  trackId: string,
  availability: EventOf<'track.availability'>['data']['availability']
): EventOf<'track.availability'> {
  sequence += 1;
  return {
    id: sequence,
    type: 'track.availability',
    at: 0,
    data: { trackId, availability }
  };
}

/**
 * Builds an `acquisition.updated` event.
 *
 * @param data The payload, with the acquisition id it must carry.
 * @returns The event.
 */
export function acquisitionEvent(data: EventOf<'acquisition.updated'>['data']): ServerEvent {
  sequence += 1;
  return { id: sequence, type: 'acquisition.updated', at: 0, data };
}

/**
 * Builds a `queue.prefetch` event.
 *
 * @param trackId The prefetched track's client id.
 * @param state Whether the scheduler started or dropped the prefetch.
 * @param client The client whose queue the prefetch was inferred from.
 * @returns The event.
 */
export function prefetchEvent(
  trackId: string,
  state: EventOf<'queue.prefetch'>['data']['state'],
  client = 'hearthsound-web-00000000'
): EventOf<'queue.prefetch'> {
  sequence += 1;
  return {
    id: sequence,
    type: 'queue.prefetch',
    at: 0,
    data: { client, trackId, priority: 'queue', state }
  };
}

/**
 * Builds a `system.notice` event.
 *
 * @param message The message the notice carries.
 * @param code The machine-readable code, when the notice has one.
 * @param level The severity.
 * @returns The event.
 */
export function noticeEvent(
  message: string,
  code?: string,
  level: EventOf<'system.notice'>['data']['level'] = 'warn'
): EventOf<'system.notice'> {
  sequence += 1;
  return { id: sequence, type: 'system.notice', at: 0, data: { level, message, code } };
}
