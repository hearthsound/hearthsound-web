/**
 * The appearance choice: whether the interface follows the system scheme or is
 * held light or dark (B05, o01).
 *
 * The choice is kept in `localStorage` under `hearthsound.appearance` and
 * applied as the `data-scheme` attribute on the document element, which the
 * design package's tokens read. "System" removes the attribute, so the
 * `prefers-color-scheme` media query decides.
 */

/** The schemes a person can pick. */
export type Scheme = 'system' | 'light' | 'dark';

/** The stored appearance. */
export interface Appearance {
  /** The picked scheme. */
  scheme: Scheme;
}

/** The `localStorage` key the appearance is kept under. */
export const APPEARANCE_KEY = 'hearthsound.appearance';

const SCHEMES: readonly string[] = ['system', 'light', 'dark'];

/**
 * Tells whether a value is one of the pickable schemes.
 *
 * @param value Any value.
 * @returns Whether `value` is a {@link Scheme}.
 */
function isScheme(value: unknown): value is Scheme {
  return typeof value === 'string' && SCHEMES.includes(value);
}

/**
 * Reads a stored appearance, falling back to the system scheme when nothing or
 * something unreadable is stored.
 *
 * @param raw The stored JSON text, or `null` when nothing is stored.
 * @returns The appearance to apply.
 *
 * @example
 * parseAppearance('{"scheme":"dark"}'); // { scheme: 'dark' }
 * parseAppearance(null); // { scheme: 'system' }
 */
export function parseAppearance(raw: string | null): Appearance {
  if (raw === null) {
    return { scheme: 'system' };
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'scheme' in value &&
      isScheme(value.scheme)
    ) {
      return { scheme: value.scheme };
    }
  } catch {
    // An unreadable value falls back to the system scheme below.
  }
  return { scheme: 'system' };
}

/**
 * Holds the appearance choice, persists it and applies it to a document.
 *
 * @example
 * const appearance = new AppearanceStore(localStorage, document.documentElement);
 * appearance.set('dark'); // data-scheme="dark", stored
 */
export class AppearanceStore {
  /** The scheme in effect. */
  scheme = $state<Scheme>('system');

  readonly #storage: Pick<Storage, 'getItem' | 'setItem'>;
  readonly #root: Pick<Element, 'setAttribute' | 'removeAttribute'>;

  /**
   * Loads the stored choice and applies it.
   *
   * @param storage Where the choice is kept.
   * @param root The element that carries `data-scheme`.
   */
  constructor(
    storage: Pick<Storage, 'getItem' | 'setItem'>,
    root: Pick<Element, 'setAttribute' | 'removeAttribute'>
  ) {
    this.#storage = storage;
    this.#root = root;
    this.scheme = parseAppearance(storage.getItem(APPEARANCE_KEY)).scheme;
    this.#apply();
  }

  /**
   * Picks a scheme, stores it and applies it.
   *
   * @param scheme The scheme to use; `system` follows the operating system.
   */
  set(scheme: Scheme): void {
    this.scheme = scheme;
    this.#storage.setItem(APPEARANCE_KEY, JSON.stringify({ scheme } satisfies Appearance));
    this.#apply();
  }

  /** Writes the scheme onto the root element. */
  #apply(): void {
    if (this.scheme === 'system') {
      this.#root.removeAttribute('data-scheme');
    } else {
      this.#root.setAttribute('data-scheme', this.scheme);
    }
  }
}

/** The browser's appearance store, created on first use. */
let shared: AppearanceStore | null = null;

/**
 * Returns the browser's appearance store, loading and applying the stored
 * choice the first time.
 *
 * @returns The shared store.
 */
export function appearance(): AppearanceStore {
  shared ??= new AppearanceStore(localStorage, document.documentElement);
  return shared;
}
