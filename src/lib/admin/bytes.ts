/**
 * Human-readable byte counts for the admin views.
 *
 * Storage usage and quotas are counted in bytes, which nobody reads; the views
 * show them in the largest unit that keeps the number small.
 */

/** The units a count is shown in, from bytes up. */
const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

/**
 * Formats a byte count.
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
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? String(value) : value.toFixed(1)} ${UNITS[unit]}`;
}
