/**
 * The fixed text and formatting the views share.
 */

/** The units a byte count is shown in, from bytes up. */
const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

/** How many bytes one gibibyte holds. */
const GIB = 1024 ** 3;

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

/**
 * Formats a byte count in gibibytes.
 *
 * Quotas and byte-valued settings are shown in GiB rather than the largest unit
 * `formatBytes` picks, so a limit keeps one unit as it changes. The count keeps
 * up to two decimals and drops trailing zeros.
 *
 * @param bytes The number of bytes; a value that is not a count renders as `-`.
 * @returns The count in GiB without the unit, for example `20`, `1.5` or
 *   `0.25`.
 */
export function formatGiB(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '-';
  }
  return (bytes / GIB).toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Reads a count of gibibytes as bytes.
 *
 * The text is what a field holds: a whole number or a decimal, with no sign,
 * separator or exponent. The stored byte count is rounded to the nearest byte.
 *
 * @param text The text of the field, or the number the field reports once it is
 *   edited.
 * @returns The byte count, or `null` when the text is empty, negative or not a
 *   number.
 */
export function parseGiB(text: unknown): number | null {
  if (typeof text === 'number') {
    return Number.isFinite(text) && text >= 0 ? Math.round(text * GIB) : null;
  }
  if (typeof text !== 'string') {
    return null;
  }
  const trimmed = text.trim();
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) {
    return null;
  }
  const gib = Number(trimmed);
  return Number.isFinite(gib) && gib >= 0 ? Math.round(gib * GIB) : null;
}
