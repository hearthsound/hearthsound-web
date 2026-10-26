/**
 * Tests for the feedback rules and the store that writes them: which value a
 * control sends, what the server's answer leaves behind, and what a refused
 * write does.
 */
import { describe, expect, it, vi } from 'vitest';

import { toasts } from '#lib/stores/toasts.svelte';

import { FeedbackStore } from './feedback.svelte';
import {
  dislikeValue,
  feedbackAfterValue,
  likeValue,
  ratingValue,
  reportedFeedback
} from './feedback';
import type { FeedbackEntity, FeedbackState } from './feedback';
import type { BulkResult, FeedbackValue } from '#lib/subsonic/types';

/** A feedback api that records the writes it is asked to make. */
class FakeFeedback {
  /** The feedback values that were sent, with the ids they named. */
  feedback: { ids: string[]; value: FeedbackValue }[] = [];

  /** The ratings that were sent, with the ids they named. */
  ratings: { id: string; rating: number }[] = [];

  /** The error every write throws, when the test sets one. */
  failure: unknown = null;

  /** How many of the written ids the server says it did not apply. */
  refused = 0;

  /**
   * Records a feedback write.
   *
   * @param ids The ids to write.
   * @param value The value to record.
   * @returns Nothing.
   */
  async setFeedback(ids: readonly string[], value: FeedbackValue): Promise<BulkResult> {
    this.feedback.push({ ids: [...ids], value });
    if (this.failure !== null) {
      throw this.failure;
    }
    return {
      applied: ids.slice(0, ids.length - this.refused),
      failed: ids.slice(ids.length - this.refused).map((id) => ({ id, reason: 'not found' }))
    };
  }

  /**
   * Records a rating write.
   *
   * @param id The entity to rate.
   * @param rating The rating to record.
   * @returns Nothing.
   */
  async setRating(id: string, rating: number): Promise<void> {
    this.ratings.push({ id, rating });
    if (this.failure !== null) {
      throw this.failure;
    }
  }
}

/** A track the caller neither likes nor dislikes and has not rated. */
const plain: FeedbackEntity = { id: 'tr_1', liked: false, disliked: false, rating: 0 };

/** A track the caller likes and rated four stars. */
const liked: FeedbackEntity = { id: 'tr_2', liked: true, disliked: false, rating: 4 };

describe('bulk feedback', () => {
  it('announces how many of several ids were taken', async () => {
    const api = new FakeFeedback();
    api.refused = 1;
    const onError = vi.fn();
    const store = new FeedbackStore(api, onError);

    await store.writeMany(
      [plain, liked, { ...plain, id: 'tr_3' }],
      'like',
      'like this song',
      'Liked'
    );

    expect(api.feedback).toEqual([{ ids: ['tr_1', 'tr_2', 'tr_3'], value: 'like' }]);
    // The applied ids are remembered, the refused one is not.
    expect(store.stateFor(plain).liked).toBe(true);
    expect(store.stateFor({ ...plain, id: 'tr_3' }).liked).toBe(false);
    // A partial write of several ids is announced, not reported as an error.
    expect(onError).not.toHaveBeenCalled();
    expect(toasts.items).toEqual([
      expect.objectContaining({ level: 'warn', message: 'Liked 2 of 3' })
    ]);
    toasts.items = [];
  });

  it('reports a single refused id with its reason', async () => {
    const api = new FakeFeedback();
    api.refused = 1;
    const onError = vi.fn();
    const store = new FeedbackStore(api, onError);

    await store.toggleLike(plain);

    expect(onError).toHaveBeenCalledWith('Could not like this song: not found');
    expect(store.stateFor(plain).liked).toBe(false);
  });
});

describe('reported feedback', () => {
  it('reads a like, a dislike and a rating out of an answer', () => {
    expect(
      reportedFeedback({
        id: 'tr_1',
        starred: '2026-01-02T03:04:05Z',
        userRating: 4,
        hearthsound: { disliked: false }
      })
    ).toEqual({ id: 'tr_1', liked: true, disliked: false, rating: 4 });
  });

  it('reports nothing for an entity the answer said nothing about', () => {
    expect(reportedFeedback({ id: 'tr_2' })).toEqual({
      id: 'tr_2',
      liked: false,
      disliked: false,
      rating: 0
    });
    expect(reportedFeedback({ id: 'tr_3', hearthsound: { disliked: true } })).toEqual({
      id: 'tr_3',
      liked: false,
      disliked: true,
      rating: 0
    });
  });
});

describe('feedback values', () => {
  it('likes what is not liked and takes the like back otherwise', () => {
    expect(likeValue(plain)).toBe('like');
    expect(likeValue(liked)).toBe('none');
  });

  it('dislikes what is not disliked and takes the dislike back otherwise', () => {
    expect(dislikeValue(plain)).toBe('dislike');
    expect(dislikeValue({ liked: false, disliked: true, rating: 0 })).toBe('none');
  });

  it('replaces the other opinion when one is recorded', () => {
    const disliked: FeedbackState = { liked: false, disliked: true, rating: 3 };

    expect(feedbackAfterValue(disliked, 'like')).toEqual({
      liked: true,
      disliked: false,
      rating: 3
    });
    expect(feedbackAfterValue({ liked: true, disliked: false, rating: 3 }, 'dislike')).toEqual({
      liked: false,
      disliked: true,
      rating: 3
    });
  });

  it('clears whichever opinion a cleared value takes back', () => {
    expect(feedbackAfterValue({ liked: true, disliked: false, rating: 2 }, 'none')).toEqual({
      liked: false,
      disliked: false,
      rating: 2
    });
  });

  it('clears the rating when the star it already carries is clicked', () => {
    expect(ratingValue(3, 3)).toBe(0);
    expect(ratingValue(3, 5)).toBe(5);
    expect(ratingValue(0, 1)).toBe(1);
  });
});

describe('feedback store', () => {
  it('renders the state the entity reported until something is written', () => {
    const store = new FeedbackStore(new FakeFeedback());

    expect(store.stateFor(liked)).toEqual({ liked: true, disliked: false, rating: 4 });
  });

  it('likes an entity and remembers it', async () => {
    const api = new FakeFeedback();
    const store = new FeedbackStore(api);

    await store.toggleLike(plain);

    expect(api.feedback).toEqual([{ ids: ['tr_1'], value: 'like' }]);
    expect(store.stateFor(plain)).toEqual({ liked: true, disliked: false, rating: 0 });
  });

  it('takes a like back on the second click', async () => {
    const api = new FakeFeedback();
    const store = new FeedbackStore(api);

    await store.toggleLike(liked);

    expect(api.feedback).toEqual([{ ids: ['tr_2'], value: 'none' }]);
    expect(store.stateFor(liked)).toEqual({ liked: false, disliked: false, rating: 4 });
  });

  it('records a dislike in place of a like', async () => {
    const api = new FakeFeedback();
    const store = new FeedbackStore(api);

    await store.toggleDislike(liked);

    expect(api.feedback).toEqual([{ ids: ['tr_2'], value: 'dislike' }]);
    expect(store.stateFor(liked)).toEqual({ liked: false, disliked: true, rating: 4 });
  });

  it('sends zero when the star an entity already carries is clicked', async () => {
    const api = new FakeFeedback();
    const store = new FeedbackStore(api);

    await store.rate(liked, 4);

    expect(api.ratings).toEqual([{ id: 'tr_2', rating: 0 }]);
    expect(store.stateFor(liked)).toEqual({ liked: true, disliked: false, rating: 0 });
  });

  it('keeps the state and reports a refused write', async () => {
    const api = new FakeFeedback();
    api.failure = new Error('the server refused it');
    const onError = vi.fn();
    const store = new FeedbackStore(api, onError);

    await store.toggleLike(plain);
    await store.rate(plain, 5);

    expect(store.stateFor(plain)).toEqual({ liked: false, disliked: false, rating: 0 });
    expect(onError).toHaveBeenCalledWith('Could not like this song: the server refused it');
    expect(onError).toHaveBeenCalledWith('Could not record your rating: the server refused it');
  });
});
