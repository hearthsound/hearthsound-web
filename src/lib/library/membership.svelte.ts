/**
 * What the client knows about the personal-library membership of the entities
 * a view shows.
 *
 * A save adds a track, an album or an artist to the caller's personal library
 * and an unsave removes it again; both are permanent changes to the account,
 * so a control starts from the membership the server reported and follows the
 * write it made. An entity nothing was heard about is outside the library,
 * which is what the vendor member reports for a catalog entity.
 */
import { toasts } from '#lib/stores/toasts.svelte';
import { libraryApi } from '#lib/subsonic/library';
import type { MembershipApi } from '#lib/subsonic/library';

/** The entity fields the membership store reads. */
export interface MembershipEntity {
  /** The entity's client id. */
  id: string;
  /** The entity's vendor member, when the answer carried one. */
  hearthsound?: { inLibrary?: boolean } | null;
}

/** The library action a control performs. */
export type MembershipAction = 'save' | 'unsave';

/**
 * Returns the action a membership control performs.
 *
 * @param inLibrary Whether the entity is in the personal library right now.
 * @returns `unsave` for an entity that is in it, `save` for one that is not.
 */
export function membershipAction(inLibrary: boolean): MembershipAction {
  return inLibrary ? 'unsave' : 'save';
}

/**
 * Returns the message shown when a membership change failed.
 *
 * @param action The action that failed.
 * @param error The error the call threw.
 * @returns The message.
 */
export function membershipFailure(action: MembershipAction, error: unknown): string {
  const what = action === 'save' ? 'add it to' : 'remove it from';
  const detail = error instanceof Error && error.message !== '' ? `: ${error.message}` : '.';
  return `Could not ${what} your library${detail}`;
}

/** The membership of the entities a view shows. */
export class MembershipStore {
  /** The membership the client wrote or read, by entity id. */
  states = $state<Record<string, boolean>>({});

  readonly #api: MembershipApi;
  readonly #onError: (message: string) => void;

  /**
   * Builds a store.
   *
   * @param api The membership writes to make.
   * @param onError Called with the message of a failed change.
   */
  constructor(
    api: MembershipApi = libraryApi,
    onError: (message: string) => void = (message) => {
      toasts.push(message, 'error');
    }
  ) {
    this.#api = api;
    this.#onError = onError;
  }

  /**
   * Reports whether an entity is in the personal library.
   *
   * What the client wrote or read wins over what the entity itself carries,
   * because a change the client made is newer than the answer it came with.
   *
   * @param entity The entity to ask about.
   * @returns `true` when the entity is in the library.
   */
  isInLibrary(entity: MembershipEntity): boolean {
    return this.states[entity.id] ?? entity.hearthsound?.inLibrary ?? false;
  }

  /**
   * Records the membership a response reported for its entities.
   *
   * @param entities The entities of the response.
   * @returns Nothing.
   */
  remember(entities: readonly MembershipEntity[]): void {
    const next = { ...this.states };
    for (const entity of entities) {
      const inLibrary = entity.hearthsound?.inLibrary;
      if (inLibrary !== undefined) {
        next[entity.id] = inLibrary;
      }
    }
    this.states = next;
  }

  /**
   * Forgets what was read or written about membership.
   *
   * What one account's answers and writes taught the client is not another
   * account's, so the map goes when the signed-in user changes.
   *
   * @returns Nothing.
   */
  reset(): void {
    this.states = {};
  }

  /**
   * Adds an entity to the personal library, or removes it again.
   *
   * The state follows the write that succeeded: a call the server refused
   * changes nothing and is reported through the store's error callback, and so
   * does an id the server answered it did not apply (each id is its own write
   * on the server, so a request can be partly applied).
   *
   * @param entity The entity to change.
   * @returns Nothing.
   */
  async toggle(entity: MembershipEntity): Promise<void> {
    const action = membershipAction(this.isInLibrary(entity));
    try {
      const result =
        action === 'save' ? await this.#api.save([entity.id]) : await this.#api.unsave([entity.id]);
      const failure = result.failed.find((entry) => entry.id === entity.id);
      if (failure !== undefined) {
        this.#onError(membershipFailure(action, new Error(failure.reason)));
        return;
      }
      this.states = { ...this.states, [entity.id]: action === 'save' };
    } catch (error) {
      this.#onError(membershipFailure(action, error));
    }
  }
}

/** The membership of the entities the running client shows. */
export const membership = new MembershipStore();
