/**
 * The caller's opinion of the entities the client shows.
 *
 * Every control renders the state of its own entity and writes through this
 * store, so a like, a dislike and a rating read the same wherever they appear.
 * A write the server refused changes nothing and is reported to the user; a
 * write that succeeded is remembered here, because it is newer than whatever
 * the answer that carried the entity said.
 */
import { toasts } from '#lib/stores/toasts.svelte';
import { libraryApi } from '#lib/subsonic/library';
import type { FeedbackApi } from '#lib/subsonic/library';
import type { FeedbackValue } from '#lib/subsonic/types';

import { dislikeValue, feedbackAfterValue, likeValue, ratingValue } from './feedback';
import type { FeedbackEntity, FeedbackState } from './feedback';

/** The caller's opinion of the entities the client shows. */
export class FeedbackStore {
  /** The state the client wrote, by entity id. */
  states = $state<Record<string, FeedbackState>>({});

  readonly #api: FeedbackApi;
  readonly #onError: (message: string) => void;

  /**
   * Builds a store.
   *
   * @param api The feedback writes to make.
   * @param onError Called with the message of a failed write.
   */
  constructor(
    api: FeedbackApi = libraryApi,
    onError: (message: string) => void = (message) => {
      toasts.push(message, 'error');
    }
  ) {
    this.#api = api;
    this.#onError = onError;
  }

  /**
   * Returns the state of an entity.
   *
   * What the client wrote wins over what the entity itself reports, because
   * the write happened after the entity was read.
   *
   * @param entity The entity to ask about.
   * @returns The state of the entity.
   */
  stateFor(entity: FeedbackEntity): FeedbackState {
    const known = this.states[entity.id];
    return known ?? { liked: entity.liked, disliked: entity.disliked, rating: entity.rating };
  }

  /**
   * Likes an entity, or takes the like back.
   *
   * @param entity The entity to change.
   * @returns Nothing.
   */
  async toggleLike(entity: FeedbackEntity): Promise<void> {
    await this.#write(entity, likeValue(this.stateFor(entity)), 'like this song');
  }

  /**
   * Dislikes an entity, or takes the dislike back.
   *
   * @param entity The entity to change.
   * @returns Nothing.
   */
  async toggleDislike(entity: FeedbackEntity): Promise<void> {
    await this.#write(entity, dislikeValue(this.stateFor(entity)), 'dislike this song');
  }

  /**
   * Records a click on one of an entity's stars.
   *
   * @param entity The entity to rate.
   * @param clicked The star that was clicked, 1 to 5.
   * @returns Nothing.
   */
  async rate(entity: FeedbackEntity, clicked: number): Promise<void> {
    const state = this.stateFor(entity);
    const rating = ratingValue(state.rating, clicked);
    try {
      await this.#api.setRating(entity.id, rating);
      this.#remember(entity.id, { ...state, rating });
    } catch (error) {
      this.#onError(this.#message('record your rating', error));
    }
  }

  /**
   * Sends a feedback value and remembers what it leaves behind.
   *
   * @param entity The entity to change.
   * @param value The value to record.
   * @param action What the control does, for the failure message.
   * @returns Nothing.
   */
  async #write(entity: FeedbackEntity, value: FeedbackValue, action: string): Promise<void> {
    const state = this.stateFor(entity);
    try {
      await this.#api.setFeedback([entity.id], value);
      this.#remember(entity.id, feedbackAfterValue(state, value));
    } catch (error) {
      this.#onError(this.#message(action, error));
    }
  }

  /**
   * Records the state of one entity.
   *
   * @param id The entity's client id.
   * @param state The state to record.
   * @returns Nothing.
   */
  #remember(id: string, state: FeedbackState): void {
    this.states = { ...this.states, [id]: state };
  }

  /**
   * Builds the message of a failed write.
   *
   * @param action What the control tried to do.
   * @param error The error the call threw.
   * @returns The message.
   */
  #message(action: string, error: unknown): string {
    const detail = error instanceof Error && error.message !== '' ? `: ${error.message}` : '.';
    return `Could not ${action}${detail}`;
  }
}

/** The opinion of the entities the running client shows. */
export const feedback = new FeedbackStore();
