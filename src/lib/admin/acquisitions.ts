/**
 * The acquisitions the admin view shows.
 *
 * An acquisition still holds work until it completes, fails or is cancelled;
 * the view filters the ledger by whether a row still holds work, cancels the
 * ones that do, and retries the ones that ended without a file. The state the
 * server reports drives all of it, so the table follows the ledger as the
 * events arrive.
 */
import type { components } from '#lib/api/schema';

/** One acquisition, as an administrator sees it. */
export type AcquisitionView = components['schemas']['AcquisitionView'];

/** Which part of the ledger the view shows. */
export type AcquisitionFilter = 'active' | 'recent' | 'all';

/** The filters the view offers, in the order it shows them. */
export const ACQUISITION_FILTERS: readonly AcquisitionFilter[] = ['active', 'recent', 'all'];

/** What each state is shown as in the table. */
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

/**
 * Returns the progress column of one acquisition.
 *
 * @param acquisition The acquisition to describe.
 * @returns The state in words, with the download percentage when the server
 *   reported one.
 */
export function acquisitionProgress(acquisition: AcquisitionView): string {
  const label = STATE_LABELS[acquisition.state] ?? acquisition.state;
  const percent = acquisition.percent;
  return percent === null || percent === undefined ? label : `${label} ${Math.floor(percent)}%`;
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

/**
 * Returns the rows one filter shows.
 *
 * @param acquisitions The acquisitions to filter.
 * @param filter Which part of the ledger to show.
 * @returns The rows that belong to the filter, in the order they were given.
 */
export function filterAcquisitions(
  acquisitions: readonly AcquisitionView[],
  filter: AcquisitionFilter
): AcquisitionView[] {
  if (filter === 'all') {
    return [...acquisitions];
  }
  return acquisitions.filter((acquisition) =>
    filter === 'active' ? acquisitionIsActive(acquisition) : !acquisitionIsActive(acquisition)
  );
}
