/**
 * The fixed text and formatting the views share.
 */

/**
 * Formats a duration as minutes and seconds.
 *
 * @param seconds The duration in seconds; unknown or negative values render as
 *   `-:--`.
 * @returns The formatted duration, for example `3:07`.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '-:--';
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/**
 * Formats a collection's length as the whole minutes a detail line shows.
 *
 * Any part of a minute counts as a minute, so a short collection reads "1 min"
 * rather than "0 min".
 *
 * @param seconds The total duration in seconds.
 * @returns The rounded-up minute total, for example `42 min`.
 */
export function formatMinuteTotal(seconds: number): string {
  return `${Math.max(1, Math.ceil(seconds / 60))} min`;
}
