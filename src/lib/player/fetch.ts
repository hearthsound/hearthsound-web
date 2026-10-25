/**
 * The fetch state both player surfaces draw.
 *
 * The player bar and the now-playing view show the same thing while a track is
 * fetched: a k10 pill beside the title naming the step, and a play disc that
 * spins while the fetch runs or turns into a retry button when it failed
 * (p19b, o07). Both read the acquisition's typed state here, so the surfaces
 * cannot disagree and rewording a label cannot change what a control does.
 */
import type { IconName } from '@hearthsound/design/icons';

import { prefetchLabel, progressLabel } from '#lib/labels';
import type { PrefetchProgress, ProgressState } from '#lib/labels';
import type { FailureReason } from '#lib/subsonic/types';
import { acquisitionIsTerminal } from '#lib/subsonic/types';
import type { PillTone } from '#lib/ui/Pill.svelte';
import type { PlayState } from '#lib/ui/PlayButton.svelte';

/** One k10 pill beside a song title. */
export interface FetchPill {
  /** The state colour. */
  tone: PillTone;
  /** The state glyph. */
  glyph: IconName;
  /** The visible label. */
  label: string;
}

/** What the player surfaces show while a track is fetched. */
export interface FetchView {
  /** Whether the fetch failed for any reason but a cancellation. */
  failed: boolean;
  /** Whether a fetch is in flight, so the disc spins. */
  fetching: boolean;
  /** The pill beside the title, or `null` when nothing is in flight. */
  pill: FetchPill | null;
}

/**
 * Reports whether a fetch failure is the user's to retry.
 *
 * A cancellation is not a failure: the user asked for it, so the disc keeps
 * its normal state and no pill appears.
 *
 * @param reason Why the acquisition failed, when it has.
 * @returns `true` for every reason but a cancellation.
 */
export function fetchFailed(reason: FailureReason | null | undefined): boolean {
  return reason !== null && reason !== undefined && reason !== 'cancelled';
}

/**
 * The pill a queued request draws when the server has no download source
 * (E-G-1).
 *
 * The request is parked until an acquisition instance exists, so claiming to
 * search for a source would be a lie the listener cannot act on.
 */
export const WAITING_FOR_SOURCE_LABEL = 'Waiting for a download source';

/**
 * Maps the acquisition flow's typed state onto the pill and the disc.
 *
 * A terminal state draws the failed pill whatever the reason says, so the pill
 * does not depend on the order the flow and the reason arrive in. A play that
 * failed after the fetch succeeded draws the same pill, because the disc has to
 * offer the retry either way.
 *
 * @param progress The state of the track being fetched, or `null` when nothing
 *   is being fetched.
 * @param failureReason Why the fetch failed, when it did.
 * @param playFailed Whether streaming the track failed after it was fetched.
 * @param sourceConfigured Whether the server has a download source at all; a
 *   request that waits for one names that instead of a search.
 * @returns The failed and fetching flags and the pill to draw.
 */
export function fetchView(
  progress: ProgressState | null | undefined,
  failureReason: FailureReason | null | undefined,
  playFailed = false,
  sourceConfigured = true
): FetchView {
  if (
    progress?.state === 'failed' ||
    progress?.state === 'cancelled' ||
    playFailed ||
    fetchFailed(failureReason)
  ) {
    return {
      failed: true,
      fetching: false,
      pill: { tone: 'error', glyph: 'adwaita-error', label: 'Failed' }
    };
  }
  if (progress === null || progress === undefined || failureReason === 'cancelled') {
    return { failed: false, fetching: false, pill: null };
  }
  const state = progress.state;
  if (state === 'queued' || state === 'resolving' || state === 'searching') {
    if (state === 'queued' && !sourceConfigured) {
      return {
        failed: false,
        fetching: true,
        pill: { tone: 'accent', glyph: 'adwaita-acquire', label: WAITING_FOR_SOURCE_LABEL }
      };
    }
    return {
      failed: false,
      fetching: true,
      pill: { tone: 'accent', glyph: 'adwaita-search', label: 'Searching sources' }
    };
  }
  if (state === 'downloading' || state === 'verifying' || state === 'importing') {
    return {
      failed: false,
      fetching: true,
      pill: { tone: 'accent', glyph: 'adwaita-acquire', label: progressLabel(progress) }
    };
  }
  return { failed: false, fetching: false, pill: null };
}

/**
 * Returns the play disc's state while a track is fetched (p19b).
 *
 * @param view The fetch state of the track.
 * @param playing Whether playback is running.
 * @returns The disc state: retry after a failure, spinning during a fetch, and
 *   otherwise the pause or play glyph.
 */
export function playDisc(view: FetchView, playing: boolean): PlayState {
  return view.failed ? 'retry' : view.fetching ? 'fetching' : playing ? 'pause' : 'play';
}

/**
 * Returns the pill of one upcoming queue row.
 *
 * The scheduler's typed answer picks the tone and glyph; the label itself is
 * the shared prefetch wording, so the row and the label can never disagree.
 *
 * @param progress The state of the queue item.
 * @returns The pill to draw.
 */
export function prefetchPill(progress: PrefetchProgress): FetchPill {
  const label = prefetchLabel(progress);
  if (progress.availability === 'local' || progress.availability === 'cached') {
    return { tone: 'success', glyph: 'adwaita-check', label };
  }
  if (progress.availability === 'unavailable') {
    return { tone: 'neutral', glyph: 'adwaita-remove', label };
  }
  if (
    progress.state !== null &&
    progress.state !== undefined &&
    !acquisitionIsTerminal(progress.state)
  ) {
    return { tone: 'accent', glyph: 'adwaita-acquire', label };
  }
  if (progress.prefetch === 'started') {
    return { tone: 'neutral', glyph: 'adwaita-queue', label };
  }
  return { tone: 'neutral', glyph: 'adwaita-remove', label };
}
