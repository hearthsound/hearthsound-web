/**
 * Comparing the two configurations a service form holds.
 *
 * A linked service's configuration comes back from the server with `[sealed]`
 * in place of every write-only field, so the form opens on what is stored
 * rather than on an empty field a save would wipe. The form's Save is enabled by
 * an edit, which means it needs to know whether what it holds differs from what
 * the server answered: an untouched `[sealed]` is not a change, and neither is
 * the same value under a different key order.
 */

/** A configuration as the document types it: free-form JSON members. */
type Config = Record<string, unknown>;

/**
 * Returns whether two configuration objects hold the same values.
 *
 * Primitives compare by identity, arrays element by element, and objects by the
 * union of their keys; a key an object does not carry and a key whose value is
 * `undefined` are the same, because JSON cannot tell them apart either.
 *
 * @param left The first value.
 * @param right The second value.
 * @returns `true` when both hold the same configuration.
 */
export function configsEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((entry, index) => configsEqual(entry, right[index]));
  }
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return false;
  }
  const first = left as Config;
  const second = right as Config;
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  for (const key of keys) {
    if (!configsEqual(first[key], second[key])) {
      return false;
    }
  }
  return true;
}
