/**
 * The caller's opinion of an entity, as the controls render it.
 *
 * A like is what the protocol calls a star, a dislike is recorded in place of a
 * like and pins nothing, and the two never hold at once. A rating is a separate
 * 1 to 5 value that clicking its own number clears. The rules are stated here
 * rather than in the controls, so every place a control appears - a row, an
 * album or artist header, the player bar - writes the same value for the same
 * state.
 */
import type { FeedbackValue } from '#lib/subsonic/types';

/** What the client knows about one entity's feedback. */
export interface FeedbackState {
  /** Whether the caller likes the entity. */
  liked: boolean;
  /** Whether the caller dislikes the entity. */
  disliked: boolean;
  /** The caller's rating from 1 to 5, or 0 when there is none. */
  rating: number;
}

/** What a feedback control is given to work from. */
export interface FeedbackEntity extends FeedbackState {
  /** The entity's client id. */
  id: string;
}

/** The feedback fields a browse response reports for an entity. */
export interface ReportedFeedback {
  /** The entity's client id. */
  id: string;
  /** When the caller starred the entity, as an ISO 8601 timestamp. */
  starred?: string;
  /** The caller's rating, 1 to 5. */
  userRating?: number;
  /** The entity's vendor member, which reports whether it is disliked. */
  hearthsound?: { disliked?: boolean } | null;
}

/**
 * Reads the feedback an entity's answer reported.
 *
 * @param entity The entity, as a browse response carried it.
 * @returns What the controls render for it.
 */
export function reportedFeedback(entity: ReportedFeedback): FeedbackEntity {
  return {
    id: entity.id,
    liked: entity.starred !== undefined,
    disliked: entity.hearthsound?.disliked === true,
    rating: entity.userRating ?? 0
  };
}

/**
 * Returns the value a like control sends.
 *
 * @param state The entity's state right now.
 * @returns `like` when the caller does not like it yet, `none` to take the
 *   like back.
 */
export function likeValue(state: FeedbackState): FeedbackValue {
  return state.liked ? 'none' : 'like';
}

/**
 * Returns the value a dislike control sends.
 *
 * @param state The entity's state right now.
 * @returns `dislike` when the caller does not dislike it yet, `none` to take
 *   the dislike back.
 */
export function dislikeValue(state: FeedbackState): FeedbackValue {
  return state.disliked ? 'none' : 'dislike';
}

/**
 * Returns the state a recorded value leaves behind.
 *
 * A like replaces a dislike and the other way round, because the server
 * records one opinion per entity per account; clearing takes whichever the
 * caller held.
 *
 * @param state The entity's state before the change.
 * @param value The value that was recorded.
 * @returns The state after it.
 */
export function feedbackAfterValue(state: FeedbackState, value: FeedbackValue): FeedbackState {
  if (value === 'like') {
    return { liked: true, disliked: false, rating: state.rating };
  }
  if (value === 'dislike') {
    return { liked: false, disliked: true, rating: state.rating };
  }
  return { liked: false, disliked: false, rating: state.rating };
}

/**
 * Returns the rating a click on a star sends.
 *
 * Clicking the number the entity already carries clears the rating, which is
 * how the protocol removes one.
 *
 * @param current The rating the entity carries right now.
 * @param clicked The star that was clicked.
 * @returns The rating to record.
 */
export function ratingValue(current: number, clicked: number): number {
  return clicked === current ? 0 : clicked;
}
