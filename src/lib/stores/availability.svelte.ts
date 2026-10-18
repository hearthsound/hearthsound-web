/**
 * Track availability as the client last heard it.
 *
 * Browse responses carry the availability of every entity they return, and the
 * server publishes a `track.availability` event whenever a track changes. Both
 * feed this one map, keyed by track id, so every badge in the interface reads
 * the same state. An id nothing is known about has no entry, which lets a view
 * tell "not heard of" from a reported state.
 */
import type { EventOf, EventStream } from './events.svelte';
import { events } from './events.svelte';
import type { Availability } from '#lib/subsonic/types';

/** The entities a browse response reported availability for. */
export interface ReportedEntity {
  /** The entity's client id. */
  id: string;
  /** The entity's vendor member, when the response carried one. */
  hearthsound?: { availability: Availability } | null;
}

/** The availability the client knows, by track id. */
export class AvailabilityStore {
  /** The reported availability, by track id. */
  states = $state<Record<string, Availability>>({});

  /**
   * Records the availability of one track.
   *
   * @param trackId The track's client id.
   * @param availability The availability the server reported.
   * @returns Nothing.
   */
  set(trackId: string, availability: Availability): void {
    this.states = { ...this.states, [trackId]: availability };
  }

  /**
   * Returns the availability of one track.
   *
   * @param trackId The track's client id.
   * @returns The availability, or `null` when nothing is known about the id.
   */
  get(trackId: string): Availability | null {
    return this.states[trackId] ?? null;
  }

  /**
   * Returns the availability of an entity.
   *
   * What the server published after the response was read wins over what the
   * response itself carried, because the events are newer.
   *
   * @param entity The entity, as a browse response reported it.
   * @returns The availability, or `null` when neither source knows one.
   */
  of(entity: ReportedEntity): Availability | null {
    return this.get(entity.id) ?? entity.hearthsound?.availability ?? null;
  }

  /**
   * Records the availability a browse response reported for its entities.
   *
   * @param entities The entities of the response.
   * @returns Nothing.
   */
  remember(entities: readonly ReportedEntity[]): void {
    const next = { ...this.states };
    for (const entity of entities) {
      const availability = entity.hearthsound?.availability;
      if (availability !== undefined) {
        next[entity.id] = availability;
      }
    }
    this.states = next;
  }

  /**
   * Applies a `track.availability` event.
   *
   * @param event The event to apply.
   * @returns Nothing.
   */
  apply(event: EventOf<'track.availability'>): void {
    this.set(event.data.trackId, event.data.availability);
  }

  /**
   * Follows a stream, applying every availability event it publishes.
   *
   * @param stream The stream to follow.
   * @returns A function that stops following.
   */
  follow(stream: EventStream): () => void {
    return stream.on('track.availability', (event) => this.apply(event));
  }
}

/** The availability the client knows, by track id. */
export const availability = new AvailabilityStore();

availability.follow(events);
