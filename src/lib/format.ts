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
