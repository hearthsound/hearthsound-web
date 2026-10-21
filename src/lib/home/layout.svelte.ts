/**
 * The Home layout this browser keeps: the section order and the sections it
 * hides (l13c B, p07b).
 *
 * Every change is written at once to `localStorage` under `hs.home`, as the
 * JSON `{"v":1,"order":[<section ids>],"hidden":[<section ids>]}` (E1). A
 * stored layout names sections this build may no longer know, and may leave
 * some out: unknown ids are ignored and a missing section is appended in the
 * default p07 order, so a stored answer never hides a section the client added
 * and never breaks the page.
 */
import {
  DEFAULT_HOME_ORDER,
  HOME_SECTION_BY_ID,
  HOME_SECTIONS,
  type HomeSection
} from './sections';

/** The `localStorage` key the layout is kept under (E1). */
export const HOME_STORAGE_KEY = 'hs.home';

/** The stored layout. */
export interface HomeLayout {
  /** The storage version; version 1 is the current shape. */
  v: 1;
  /** Every section id, in the order Home draws them. */
  order: string[];
  /** The sections the browser hides. */
  hidden: string[];
}

/**
 * Keeps the known ids of a stored list, in order and without duplicates.
 *
 * @param value The stored value, of any shape.
 * @returns The ids of sections this build knows.
 */
function knownIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const id of value) {
    if (typeof id === 'string' && HOME_SECTION_BY_ID[id] !== undefined && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Reads a stored layout, falling back to the default order when nothing or
 * something unreadable is stored.
 *
 * @param raw The stored JSON text, or `null` when nothing is stored.
 * @returns The layout to draw, with every section named exactly once.
 *
 * @example
 * parseHomeLayout('{"v":1,"order":["recently-added"],"hidden":["mood-playlists"]}');
 * // order: ["recently-added", <the other twelve in the default order>]
 */
export function parseHomeLayout(raw: string | null): HomeLayout {
  let value: unknown = null;
  try {
    value = raw === null ? null : JSON.parse(raw);
  } catch {
    // An unreadable value falls back to the default layout below.
  }
  const record: Record<string, unknown> =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const order = knownIds(record.order);
  for (const id of DEFAULT_HOME_ORDER) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }
  // A browser with nothing stored gets the p07 defaults: the eight first
  // sections are on, the five after them off. A stored answer names its own
  // hidden set, so turning one of the defaults off, or all of them on, holds.
  const hidden = Array.isArray(record.hidden)
    ? knownIds(record.hidden)
    : HOME_SECTIONS.filter((section) => !section.defaultOn).map((section) => section.id);
  return { v: 1, order, hidden };
}

/**
 * Writes a layout as the stored JSON.
 *
 * @param layout The layout to store.
 * @returns The JSON text for the `hs.home` key.
 */
export function serializeHomeLayout(layout: HomeLayout): string {
  return JSON.stringify({ v: 1, order: layout.order, hidden: layout.hidden } satisfies HomeLayout);
}

/** The Home layout of one browser. */
export class HomeLayoutStore {
  /** Every section id, in the order Home draws them. */
  order = $state<string[]>([...DEFAULT_HOME_ORDER]);

  /** The sections the browser hides. */
  hidden = $state<string[]>([]);

  readonly #storage: Pick<Storage, 'getItem' | 'setItem'>;

  /**
   * Loads the stored layout.
   *
   * @param storage Where the layout is kept.
   */
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) {
    this.#storage = storage;
    const layout = parseHomeLayout(storage.getItem(HOME_STORAGE_KEY));
    this.order = layout.order;
    this.hidden = layout.hidden;
  }

  /** The sections in order, as the page and the dialog draw them. */
  get sections(): HomeSection[] {
    return this.order
      .map((id) => HOME_SECTION_BY_ID[id])
      .filter((section): section is HomeSection => section !== undefined);
  }

  /** The sections that are not hidden. */
  get shown(): HomeSection[] {
    return this.sections.filter((section) => !this.hidden.includes(section.id));
  }

  /**
   * Shows or hides one section and stores the change.
   *
   * @param id The section's id.
   * @param shown Whether the section is shown.
   */
  setShown(id: string, shown: boolean): void {
    if (HOME_SECTION_BY_ID[id] === undefined) {
      return;
    }
    const without = this.hidden.filter((hidden) => hidden !== id);
    this.hidden = shown ? without : [...without, id];
    this.#save();
  }

  /**
   * Replaces the order with the one a drag or a key move produced, keeping
   * only the known ids and appending any section the list left out.
   *
   * @param ids The section ids in their new order.
   */
  reorder(ids: readonly string[]): void {
    const order = knownIds(ids);
    for (const section of HOME_SECTIONS) {
      if (!order.includes(section.id)) {
        order.push(section.id);
      }
    }
    this.order = order;
    this.#save();
  }

  /** Stores the layout; every change calls this at once (l13c B). */
  #save(): void {
    this.#storage.setItem(
      HOME_STORAGE_KEY,
      serializeHomeLayout({ v: 1, order: this.order, hidden: this.hidden })
    );
  }
}

/** The browser's Home layout, loaded the first time. */
let shared: HomeLayoutStore | null = null;

/**
 * Returns the browser's Home layout, loading the stored one first.
 *
 * @returns The shared layout.
 */
export function homeLayout(): HomeLayoutStore {
  shared ??= new HomeLayoutStore(localStorage);
  return shared;
}
