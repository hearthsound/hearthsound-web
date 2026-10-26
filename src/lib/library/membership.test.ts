/**
 * Tests for the membership store: the action a control performs, the state it
 * reports and what a refused write leaves behind.
 */
import { describe, expect, it, vi } from 'vitest';

import type { BulkResult } from '#lib/subsonic/types';

import { membershipAction, MembershipStore, membershipFailure } from './membership.svelte';
import type { MembershipEntity, MembershipAction } from './membership.svelte';

/** A membership api that records the writes it is asked to make. */
class FakeMembership {
  /** The actions that were sent, with the ids they named. */
  writes: { action: MembershipAction; ids: string[] }[] = [];

  /** The error every write throws, when the test sets one. */
  failure: unknown = null;

  /** How many of the written ids the server says it did not apply. */
  refused = 0;

  /**
   * Records a save.
   *
   * @param ids The ids to add.
   * @returns The per-id result.
   */
  async save(ids: readonly string[]): Promise<BulkResult> {
    return this.#record('save', ids);
  }

  /**
   * Records an unsave.
   *
   * @param ids The ids to remove.
   * @returns The per-id result.
   */
  async unsave(ids: readonly string[]): Promise<BulkResult> {
    return this.#record('unsave', ids);
  }

  /**
   * Records a write, or throws the scripted failure.
   *
   * @param action The action that was sent.
   * @param ids The ids it named.
   * @returns The per-id result.
   */
  #record(action: MembershipAction, ids: readonly string[]): BulkResult {
    this.writes.push({ action, ids: [...ids] });
    if (this.failure !== null) {
      throw this.failure;
    }
    return {
      applied: ids.slice(0, ids.length - this.refused),
      failed: ids.slice(ids.length - this.refused).map((id) => ({ id, reason: 'not found' }))
    };
  }
}

/** An entity the server reported outside the personal library. */
const outside: MembershipEntity = { id: 'al_1', hearthsound: { inLibrary: false } };

/** An entity the server reported inside the personal library. */
const inside: MembershipEntity = { id: 'al_2', hearthsound: { inLibrary: true } };

describe('membership store', () => {
  it('reports an id the server answered it did not apply', async () => {
    const api = new FakeMembership();
    api.refused = 1;
    const onError = vi.fn();
    const store = new MembershipStore(api, onError);

    await store.toggle(outside);

    expect(onError).toHaveBeenCalledWith('Could not add it to your library: not found');
    expect(store.isInLibrary(outside)).toBe(false);
  });

  it('reads the membership out of the entity when it read nothing else', () => {
    const store = new MembershipStore(new FakeMembership());

    expect(store.isInLibrary(inside)).toBe(true);
    expect(store.isInLibrary(outside)).toBe(false);
    expect(store.isInLibrary({ id: 'tr_1' })).toBe(false);
  });

  it('saves an entity the library does not hold and reports it there', async () => {
    const api = new FakeMembership();
    const store = new MembershipStore(api);

    await store.toggle(outside);

    expect(api.writes).toEqual([{ action: 'save', ids: ['al_1'] }]);
    expect(store.isInLibrary(outside)).toBe(true);
  });

  it('removes an entity the library holds and reports it gone', async () => {
    const api = new FakeMembership();
    const store = new MembershipStore(api);

    await store.toggle(inside);

    expect(api.writes).toEqual([{ action: 'unsave', ids: ['al_2'] }]);
    expect(store.isInLibrary(inside)).toBe(false);
  });

  it('keeps the reported membership and reports a refused write', async () => {
    const api = new FakeMembership();
    api.failure = new Error('the server refused it');
    const onError = vi.fn();
    const store = new MembershipStore(api, onError);
    store.remember([inside]);

    await store.toggle(inside);

    expect(store.isInLibrary(inside)).toBe(true);
    expect(onError).toHaveBeenCalledWith(
      'Could not remove it from your library: the server refused it'
    );
  });

  it('remembers what a response reported for its entities', () => {
    const store = new MembershipStore(new FakeMembership());

    store.remember([inside, outside, { id: 'tr_1' }]);

    expect(store.isInLibrary({ id: 'al_2' })).toBe(true);
    expect(store.isInLibrary({ id: 'al_1' })).toBe(false);
    expect(store.isInLibrary({ id: 'tr_1' })).toBe(false);
  });

  it('forgets a remembered mark when the store is reset', () => {
    const store = new MembershipStore(new FakeMembership());
    store.remember([inside]);

    store.reset();

    expect(store.isInLibrary({ id: 'al_2', hearthsound: { inLibrary: false } })).toBe(false);
  });

  it('overwrites a locally written mark with what a later answer reported', async () => {
    const store = new MembershipStore(new FakeMembership());
    await store.toggle(outside);
    expect(store.isInLibrary(outside)).toBe(true);

    store.remember([{ id: 'al_1', hearthsound: { inLibrary: false } }]);

    expect(store.isInLibrary(outside)).toBe(false);
  });
});

describe('membership action', () => {
  it('saves what is outside the library and removes what is inside', () => {
    expect(membershipAction(false)).toBe('save');
    expect(membershipAction(true)).toBe('unsave');
  });
});

describe('membership failure', () => {
  it('names the action and carries the server message when there is one', () => {
    expect(membershipFailure('save', null)).toBe('Could not add it to your library.');
    expect(membershipFailure('save', new Error('no such album'))).toBe(
      'Could not add it to your library: no such album'
    );
  });
});
