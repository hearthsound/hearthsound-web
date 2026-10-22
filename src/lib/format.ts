/**
 * The fixed text and formatting the views share.
 */

/** The units a byte count is shown in, from bytes up. */
const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

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

/**
 * Formats a byte count.
 *
 * Storage usage and quotas are counted in bytes, which nobody reads; the views
 * show them in the largest unit that keeps the number small.
 *
 * @param bytes The number of bytes; a value that is not a count renders as
 *   `-`.
 * @returns The count with its unit, for example `1.5 GiB`.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '-';
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? String(value) : value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}
