/**
 * The acquisitions the admin view shows.
 *
 * An acquisition still holds work until it completes, fails or is cancelled;
 * the view puts the ones that still hold work under Active and the ones that
 * ended under Recent, words the state as a k10 pill, and cancels or retries the
 * rows that allow it. The state the server reports drives all of it, so the
 * groups follow the ledger as the events arrive.
 */
import type { IconName } from '@hearthsound/design/icons';

import type { components } from '#lib/api/schema';
import { FAILURE_REASONS, failureLabel } from '#lib/labels';
import type { AcquisitionUpdatedPayload } from '#lib/stores/events.svelte';
import type { FailureReason } from '#lib/subsonic/types';

/** One acquisition, as an administrator sees it. */
export type AcquisitionView = components['schemas']['AcquisitionView'];

/** The tone a k10 pill takes. */
export type AcquisitionTone = 'success' | 'warning' | 'error' | 'neutral' | 'accent';

/** The k10 pill one acquisition state is shown as. */
export interface AcquisitionPill {
  /** The state colour. */
  tone: AcquisitionTone;
  /** The glyph of the state group. */
  glyph: IconName;
  /** The visible label, which is also the accessible text. */
  label: string;
}

/** What a park state is shown as, in the admin list's own words. */
const PARK_LABELS: Record<string, string> = {
  'no-source': 'Waiting for a source',
  'source-unavailable': 'Download source not answering'
};

/** What each state is shown as. */
const STATE_LABELS: Record<string, string> = {
  queued: 'Queued',
  resolving: 'Searching sources',
  searching: 'Searching sources',
  downloading: 'Downloading',
  verifying: 'Verifying',
  importing: 'Importing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled'
};

/** The k10 colour and glyph of each state group (components.md k10). */
const STATE_PILLS: Record<string, { tone: AcquisitionTone; glyph: IconName }> = {
  queued: { tone: 'neutral', glyph: 'adwaita-queue' },
  resolving: { tone: 'accent', glyph: 'adwaita-search' },
  searching: { tone: 'accent', glyph: 'adwaita-search' },
  downloading: { tone: 'accent', glyph: 'adwaita-acquire' },
  verifying: { tone: 'accent', glyph: 'adwaita-refresh' },
  importing: { tone: 'accent', glyph: 'adwaita-refresh' },
  completed: { tone: 'success', glyph: 'adwaita-check' },
  failed: { tone: 'error', glyph: 'adwaita-error' },
  cancelled: { tone: 'neutral', glyph: 'adwaita-remove' }
};

/**
 * Returns the label of one acquisition's state.
 *
 * Only a download carries its percentage in the pill (copy.md AC-05); a
 * finished or failed row reads "Completed", "Failed" or "Cancelled" alone. A
 * parked row names the cause instead of its step: no source is configured at
 * all, or the one configured cannot answer (UR1).
 *
 * @param acquisition The acquisition to describe.
 * @returns The state in words, with the download percentage when the server
 *   reported one.
 */
export function acquisitionProgress(acquisition: AcquisitionView): string {
  // A parked acquisition still reads as queued in the ledger; the row says why
  // it is not about to run, in the same place a running row says its step (UR1).
  if (acquisition.awaitingSource) {
    return PARK_LABELS[acquisition.parkReason ?? ''] ?? 'Waiting for a source';
  }
  const label = STATE_LABELS[acquisition.state] ?? acquisition.state;
  const percent = acquisition.percent;
  if (acquisition.state !== 'downloading' || percent === null || percent === undefined) {
    return label;
  }
  return `${label} ${Math.floor(percent)}%`;
}

/**
 * Returns the k10 pill one acquisition is shown as.
 *
 * @param acquisition The acquisition to describe.
 * @returns The tone, the glyph and the label of its state.
 */
export function acquisitionPill(acquisition: AcquisitionView): AcquisitionPill {
  const state = STATE_PILLS[acquisition.state];
  return {
    tone: acquisition.awaitingSource ? 'neutral' : (state?.tone ?? 'neutral'),
    glyph: acquisition.awaitingSource ? 'adwaita-pause' : (state?.glyph ?? 'custom-unknown'),
    label: acquisitionProgress(acquisition)
  };
}

/**
 * Returns the title an acquisition row shows.
 *
 * A track acquisition names its track; an album acquisition names the album,
 * because its track title is empty. A row neither names is the client's own
 * "Unknown track", which is what an older server's album row would read.
 *
 * @param acquisition The acquisition to describe.
 * @returns The title the row's first line shows.
 */
export function acquisitionTargetTitle(acquisition: AcquisitionView): string {
  return acquisition.trackTitle ?? acquisition.albumTitle ?? 'Unknown track';
}

/**
 * Returns the kind of target an acquisition row names.
 *
 * @param acquisition The acquisition to describe.
 * @returns `Album` or `Track`, for the row's accessible text (E-G-5).
 */
export function acquisitionTargetKindLabel(acquisition: AcquisitionView): string {
  return acquisition.targetKind === 'album' ? 'Album' : 'Track';
}

/**
 * Returns the muted summary line of one acquisition row.
 *
 * @param acquisition The acquisition to describe.
 * @param updated The row's update time, already worded for the row.
 * @returns `<artist> - <priority> priority - <instance> - <time>`, leaving out
 *   the parts the server does not name rather than printing empty dashes.
 */
export function acquisitionSummary(acquisition: AcquisitionView, updated: string): string {
  const priority = acquisition.priority;
  const parts = [
    acquisition.trackArtist ?? acquisition.albumArtist,
    `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`,
    acquisition.instance,
    updated
  ].filter((part): part is string => part !== null && part !== undefined && part !== '');
  return parts.join(' - ');
}

/**
 * Words one update time for a row.
 *
 * @param at The unix millisecond timestamp.
 * @returns The local time of day, e.g. "12:04".
 */
export function timeText(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Returns whether an acquisition still holds work.
 *
 * @param acquisition The acquisition to inspect.
 * @returns `true` while it can still produce a file.
 */
export function acquisitionIsActive(acquisition: AcquisitionView): boolean {
  return (
    acquisition.state !== 'completed' &&
    acquisition.state !== 'failed' &&
    acquisition.state !== 'cancelled'
  );
}

/**
 * Words why one acquisition failed.
 *
 * The server reports a machine code; the row shows the same sentence a track's
 * badge shows, and a code this client does not know still reads as a sentence
 * rather than as the code.
 *
 * @param acquisition The acquisition to describe.
 * @returns The sentence, or an empty line when the server gave no reason.
 */
export function acquisitionFailureText(acquisition: AcquisitionView): string {
  const reason = acquisition.failureReason;
  if (reason === null || reason === undefined) {
    return '';
  }
  const what = acquisition.targetKind === 'album' ? 'album' : 'song';
  if (reason in FAILURE_REASONS) {
    return failureLabel(reason as FailureReason, what);
  }
  return failureLabel(undefined, what);
}

/** The two groups after one event of the stream was applied. */
export interface MergedUpdate {
  /** The rows that still hold work. */
  active: AcquisitionView[];
  /** The rows that ended. */
  recent: AcquisitionView[];
  /** The line the page announces to assistive technology. */
  announcement: string;
  /** Whether the event named a row neither group holds. */
  unknown: boolean;
}

/**
 * Applies one update from the event stream to the groups its row belongs to.
 *
 * An event for a row neither group holds is reported as unknown and leaves both
 * lists as they were: the creation frame names an id the page has never read,
 * and only a list read carries a row's title.
 *
 * @param update The acquisition the server reported.
 * @param at When the server published the update, in unix milliseconds.
 * @param active The rows that still hold work.
 * @param recent The rows that ended.
 * @returns The two groups, the announcement line and whether the id was known.
 */
export function mergeUpdate(
  update: AcquisitionUpdatedPayload,
  at: number,
  active: AcquisitionView[],
  recent: AcquisitionView[]
): MergedUpdate {
  const known =
    active.find((row) => row.id === update.acquisitionId) ??
    recent.find((row) => row.id === update.acquisitionId);
  if (known === undefined) {
    return { active, recent, announcement: '', unknown: true };
  }
  const stateActive = acquisitionIsActive({ ...known, state: update.state });
  const merged: AcquisitionView = {
    ...known,
    state: update.state,
    percent: update.percent ?? (update.state === 'downloading' ? (known.percent ?? null) : null),
    priority: update.priority,
    instance: update.instance ?? known.instance,
    failureReason: stateActive ? null : (update.failureReason ?? known.failureReason),
    awaitingSource: stateActive && update.awaitingSource === true,
    parkReason: stateActive ? (update.parkReason ?? null) : null,
    updatedAt: at
  };
  const announcement = `${acquisitionTargetTitle(merged)}: ${acquisitionProgress(merged)}`;
  const keptActive = active.filter((row) => row.id !== merged.id);
  const keptRecent = recent.filter((row) => row.id !== merged.id);
  return {
    active: stateActive ? [merged, ...keptActive] : keptActive,
    recent: stateActive ? keptRecent : [merged, ...keptRecent],
    announcement,
    unknown: false
  };
}

/**
 * Returns whether one acquisition can be cancelled.
 *
 * @param acquisition The acquisition to inspect.
 * @returns `true` while it still holds work.
 */
export function canCancel(acquisition: AcquisitionView): boolean {
  return acquisitionIsActive(acquisition);
}

/**
 * Returns whether one acquisition can be retried.
 *
 * @param acquisition The acquisition to inspect.
 * @returns `true` when it ended without a file.
 */
export function canRetry(acquisition: AcquisitionView): boolean {
  return acquisition.state === 'failed' || acquisition.state === 'cancelled';
}
