/**
 * The client's fixed user-facing strings.
 *
 * Availability badges, acquisition progress and queue prefetch state are
 * derived here so every view that renders them shows the same words for the
 * same state. The mapping is total: a state the client does not recognise
 * still renders something the user can act on.
 */
import { acquisitionIsTerminal } from './subsonic/types';
import type { AcquisitionState, Availability, FailureReason, ParkReason } from './subsonic/types';

/** The badge text of each availability state. */
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  local: 'On server',
  cached: 'Cached',
  acquiring: 'Downloading',
  remote: 'Not on server',
  unavailable: 'Unavailable'
};

/** The explanation of each acquisition failure reason. */
export const FAILURE_REASONS: Record<FailureReason, string> = {
  'no-candidates': 'no source has it',
  'no-acceptable-quality': 'no source meets the quality profile',
  'all-candidates-failed': 'every source failed',
  'verification-failed': 'the download did not match',
  'backend-unavailable': 'the download service is unreachable',
  'quota-exceeded': 'your daily quota is used up',
  'permission-denied': 'you may not acquire songs',
  timeout: 'it took too long',
  cancelled: 'it was cancelled'
};

/** What a track that failed to stream says when nothing else explains it. */
export const STREAM_FAILED_SENTENCE = 'Could not play this song.';

/** What a parked acquisition says while the server serves no acquisition source. */
export const WAITING_FOR_SOURCE_LABEL = 'Waiting for a download source';

/** What a parked acquisition says while the source exists but cannot answer. */
export const WAITING_FOR_SOURCE_ANSWER_LABEL = 'Waiting for the download source to answer';

/** The sentence a parked acquisition's tooltip shows. */
export const WAITING_FOR_SOURCE_SENTENCE =
  'This song will download once an acquisition source answers again.';

/**
 * Returns the words of a parked acquisition.
 *
 * A request that cannot be attempted waits instead of failing (UR1), and the
 * two causes are worth different words: no source is configured at all, or one
 * is configured and cannot answer.
 *
 * @param reason Why the acquisition waits, when the server named the cause.
 * @returns The label the surfaces show.
 */
export function waitingForSourceLabel(reason?: ParkReason | null): string {
  return reason === 'source-unavailable'
    ? WAITING_FOR_SOURCE_ANSWER_LABEL
    : WAITING_FOR_SOURCE_LABEL;
}

/** What the surfaces may say about a failure, beyond its reason. */
export interface FailureSentenceOptions {
  /** Whether streaming the track failed after it was fetched (A-web-player-7). */
  playFailed?: boolean;
  /** What the acquisition was for; a song when not given (E-G-5). */
  target?: AcquisitionTarget;
}

/** What the client knows about one item's progress toward being playable. */
export interface ProgressState {
  /** The active acquisition's state, when one is running. */
  state?: AcquisitionState | null;
  /** The item's availability, when the server reported one. */
  availability?: Availability | null;
  /** The download percentage, when one is known. */
  percent?: number | null;
  /** Why the acquisition failed, when it has failed. */
  failureReason?: FailureReason | null;
  /** Whether the acquisition waits for a download source rather than running. */
  awaitingSource?: boolean | null;
  /** Why it waits, when the server named the cause. */
  parkReason?: ParkReason | null;
}

/** What the scheduler and the ledger say about one queue item. */
export interface PrefetchProgress {
  /** The item's availability, when the server reported one. */
  availability?: Availability | null;
  /** The active acquisition's state, when one is running. */
  state?: AcquisitionState | null;
  /** The download percentage, when one is known. */
  percent?: number | null;
  /** What the scheduler answered for the item, when it announced anything. */
  prefetch?: 'started' | 'dropped' | null;
}

/**
 * Returns the badge text of an availability state.
 *
 * @param availability The reported availability.
 * @returns The badge text.
 */
export function availabilityLabel(availability: Availability): string {
  return AVAILABILITY_LABELS[availability] ?? availability;
}

/** What an acquisition was for: one track, or a whole album. */
export type AcquisitionTarget = 'song' | 'album';

/**
 * Returns the text of a failure reason.
 *
 * @param reason The reason the acquisition failed, when the server gave one.
 * @param what What the acquisition was for; a song when not given.
 * @returns A sentence explaining the failure.
 */
export function failureLabel(
  reason: FailureReason | null | undefined,
  what: AcquisitionTarget = 'song'
): string {
  const explanation = reason === null || reason === undefined ? null : FAILURE_REASONS[reason];
  const subject = what === 'album' ? 'this album' : 'this song';
  return explanation === null || explanation === undefined
    ? `Could not get ${subject}.`
    : `Could not get ${subject}: ${explanation}.`;
}

/**
 * Returns a failure reason as the sentence a tooltip shows (o07, PLY-11a).
 *
 * The pill beside a failing song stays "Failed"; the reason itself is the
 * tooltip's text, capitalised and closed with a full stop. A stream that
 * failed after the fetch, with no acquisition reason to name, falls back to
 * {@link STREAM_FAILED_SENTENCE} so a play failure cannot read as a fetch
 * failure (A-web-player-7).
 *
 * @param reason The reason the acquisition failed, when the server gave one.
 * @param options Whether the track failed to play after it was fetched, and
 *   what the acquisition was for.
 * @returns A sentence explaining the failure.
 */
export function failureSentence(
  reason: FailureReason | null | undefined,
  options: FailureSentenceOptions = {}
): string {
  const explanation = reason === null || reason === undefined ? null : FAILURE_REASONS[reason];
  if (explanation === null || explanation === undefined) {
    if (options.playFailed === true) {
      return STREAM_FAILED_SENTENCE;
    }
    return options.target === 'album' ? 'Could not get this album.' : 'Could not get this song.';
  }
  return `${explanation.charAt(0).toUpperCase()}${explanation.slice(1)}.`;
}

/**
 * Returns the progress label of an item the client is acquiring.
 *
 * A playable item is `Ready`; a failure names its reason; every state between
 * the request and the import reports the download.
 *
 * @param progress The state of the item.
 * @returns The label, or an empty string while nothing is known.
 */
export function progressLabel(progress: ProgressState): string {
  const { availability, awaitingSource, state, percent, failureReason, parkReason } = progress;
  if (availability === 'local' || availability === 'cached') {
    return 'Ready';
  }
  if (state === 'failed') {
    return failureLabel(failureReason);
  }
  if (awaitingSource === true) {
    return waitingForSourceLabel(parkReason);
  }
  if (state === 'cancelled') {
    return 'Cancelled';
  }
  if (state === 'queued' || state === 'resolving' || state === 'searching') {
    return 'Searching sources';
  }
  if (state === 'downloading') {
    return percent === null || percent === undefined
      ? 'Downloading'
      : `Downloading ${Math.floor(percent)}%`;
  }
  if (state === 'verifying' || state === 'importing') {
    return 'Downloading 100%';
  }
  return availability === null || availability === undefined ? '' : availabilityLabel(availability);
}

/**
 * Returns the prefetch label of one queue item.
 *
 * @param progress The state of the item.
 * @returns The label.
 */
export function prefetchLabel(progress: PrefetchProgress): string {
  const { availability, state, percent, prefetch } = progress;
  if (availability === 'local' || availability === 'cached') {
    return 'Ready';
  }
  if (availability === 'unavailable') {
    return 'Unavailable';
  }
  if (state !== null && state !== undefined && !acquisitionIsTerminal(state)) {
    return percent === null || percent === undefined
      ? 'Prefetching'
      : `Prefetching ${Math.floor(percent)}%`;
  }
  if (prefetch === 'started') {
    return 'Prefetch queued';
  }
  return 'Not prefetched';
}
