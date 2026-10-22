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
 * finished or failed row reads "Completed", "Failed" or "Cancelled" alone.
 *
 * @param acquisition The acquisition to describe.
 * @returns The state in words, with the download percentage when the server
 *   reported one.
 */
export function acquisitionProgress(acquisition: AcquisitionView): string {
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
    tone: state?.tone ?? 'neutral',
    glyph: state?.glyph ?? 'custom-unknown',
    label: acquisitionProgress(acquisition)
  };
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
    acquisition.trackArtist,
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
