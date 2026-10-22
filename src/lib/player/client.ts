/**
 * This tab's client instance name.
 *
 * The server correlates a declared queue with the client that declared it, so
 * every tab needs a name of its own: two tabs sharing one name would overwrite
 * each other's queue. The name is created once per tab and kept in session
 * storage, which is already scoped to the tab.
 */

/** The key this tab's client instance name is kept under. */
export const CLIENT_NAME_KEY = 'hearthsound-web.client';

/**
 * Returns this tab's client instance name, creating it once per tab.
 *
 * A fresh name is `hearthsound-web-` followed by eight hex characters.
 *
 * @param storage The storage to keep the name in; the browser's session
 *   storage when not given.
 * @returns The name.
 */
export function clientName(
  storage: Storage | null = typeof sessionStorage === 'undefined' ? null : sessionStorage
): string {
  const existing = storage?.getItem(CLIENT_NAME_KEY) ?? null;
  if (existing !== null) {
    return existing;
  }
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const name = `hearthsound-web-${hex}`;
  storage?.setItem(CLIENT_NAME_KEY, name);
  return name;
}
